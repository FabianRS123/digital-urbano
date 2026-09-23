import type { RealSnapshot, ObservedFacility } from '../data/realData';
import type { HealthFacility, Territory, AIModelBenchmark, EquityMetric } from '../types';
import { DigitalTwinEngine } from './simulationEngine';
import { getHotspotCategory } from './riskThresholds';

export function nextMonth(month: string, offset = 1): string {
  const [year, number] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, number - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
export function monthLabel(month: string): string {
  const [year, number] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('es-PE', { month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, number - 1, 1)));
}
export function percentile(values: number[], fraction: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (sorted.length - 1) * fraction;
  const lower = Math.floor(rank), upper = Math.ceil(rank);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (rank - lower);
}
export function seasonalForecast(history: Record<string, number>, month: string): number | null {
  const previousYear = `${Number(month.slice(0, 4)) - 1}${month.slice(4)}`;
  const fromSeason = history[previousYear];
  if (fromSeason !== undefined) return fromSeason;
  const available = Object.keys(history).filter((key) => key < month).sort();
  return available.length ? history[available.at(-1)!] : null;
}
export function benchmarkForecast(history: Record<string, number>): { seasonal: number; last: number; count: number } {
  const months = Object.keys(history).sort();
  let seasonalError = 0, lastError = 0, count = 0;
  for (let index = 12; index < months.length; index++) {
    const month = months[index], previous = months[index - 1];
    const actual = history[month], seasonal = history[`${Number(month.slice(0, 4)) - 1}${month.slice(4)}`];
    if (seasonal === undefined) continue;
    seasonalError += Math.abs(actual - seasonal);
    lastError += Math.abs(actual - history[previous]);
    count++;
  }
  return { seasonal: count ? seasonalError / count : NaN, last: count ? lastError / count : NaN, count };
}
function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const radians = (degree: number) => degree * Math.PI / 180;
  const latitude = radians(b.lat - a.lat), longitude = radians(b.lng - a.lng);
  const h = Math.sin(latitude / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(longitude / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}
function isEligible(f: ObservedFacility): boolean {
  return f.operationalStatus === 'Operativo' &&
    /GOBIERNO REGIONAL|GOBIERNO LOCAL|MINISTERIO DE SALUD|MINSA|ESSALUD|SEGURO SOCIAL|SANIDAD/i.test(f.institution ?? '') &&
    /^I-[1-4]$/.test(f.category);
}
function median(values: number[]): number | null { return percentile(values, 0.5); }

export interface ModelView {
  version: string; createdAt: string; checkedAt: string; month: string; months: string[]; territories: Territory[];
  facilities: HealthFacility[]; sources: RealSnapshot['sources']; warnings: string[];
  benchmarks: AIModelBenchmark[]; equity: EquityMetric[];
}

export function buildModelView(snapshot: RealSnapshot, month = snapshot.months.at(-1)!): ModelView {
  if (!snapshot.months.includes(month)) throw new Error(`Mes sin atenciones SIS: ${month}`);
  const lastYear = Number(month.slice(0, 4));
  const previousMonths = Array.from({ length: 12 }, (_, i) => nextMonth(month, i - 11));
  const historicalByFacility = new Map(snapshot.districts.flatMap((district) =>
    Object.entries(district.facilityHistory)));
  const directCapacity = new Map<string, number>();
  for (const facility of snapshot.facilities.filter((item) => item.operationalStatus === 'Operativo')) {
    const history = historicalByFacility.get(facility.code) ?? {};
    const observed = previousMonths.filter((key) => history[key] !== undefined).map((key) => history[key]);
    if (observed.length >= 6) directCapacity.set(facility.code, Math.ceil(percentile(observed, 0.95)!));
  }
  const categoryMedian = new Map<string, number>();
  for (const category of new Set(snapshot.facilities.map((f) => f.category))) {
    const capacities = snapshot.facilities.filter((f) => f.category === category && directCapacity.has(f.code))
      .map((f) => directCapacity.get(f.code)!);
    const value = median(capacities);
    if (value !== null) categoryMedian.set(category, Math.ceil(value));
  }
  const facilities: HealthFacility[] = snapshot.facilities.map((facility) => {
    const history = historicalByFacility.get(facility.code);
    const monthlyCapacity = facility.operationalStatus === 'Operativo'
      ? (directCapacity.get(facility.code) ?? categoryMedian.get(facility.category) ?? null) : null;
    const currentMonthlyDemand = history?.[month] ?? null;
    const capacityMethod = monthlyCapacity === null ? 'Sin referencia válida' : directCapacity.has(facility.code)
      ? 'Percentil 95 de consultas SIS en los últimos 12 meses con al menos 6 meses válidos'
      : 'Mediana de IPRESS públicas de igual categoría con cobertura suficiente';
    return { ...facility, category: facility.category as HealthFacility['category'],
      type: facility.type as HealthFacility['type'],
      operationalStatus: facility.operationalStatus as HealthFacility['operationalStatus'],
      schedule: facility.schedule as HealthFacility['schedule'], monthlyCapacity, currentMonthlyDemand,
      activitySis: Boolean(history && Object.keys(history).length), capacityMethod,
      pressureRatio: monthlyCapacity && currentMonthlyDemand !== null ? currentMonthlyDemand / monthlyCapacity : null };
  });
  const raw = snapshot.districts.map((district) => {
    const population = district.populationByYear[String(lastYear)];
    if (!population) throw new Error(`Población INEI ausente para ${district.code} en ${lastYear}`);
    const povertyRate = (district.povertyInterval[0] + district.povertyInterval[1]) / 200;
    const nearby = facilities.filter((f) => isEligible(f as ObservedFacility) &&
      f.latitude !== null && f.longitude !== null);
    const distanceKm = nearby.length ? Math.min(...nearby.map((f) => haversine(district.coordinates,
      { lat: f.latitude!, lng: f.longitude! }))) : null;
    const travelMinutes = distanceKm === null ? null : 5 + distanceKm * 1.3 * 3;
    const access = travelMinutes === null ? null : Math.exp(-travelMinutes / 30);
    const eligible = facilities.filter((f) => f.districtId === district.id && f.operationalStatus === 'Operativo' && f.activitySis);
    const capacityValues = eligible.map((f) => f.monthlyCapacity).filter((n): n is number => n !== null);
    const capacity = capacityValues.length ? capacityValues.reduce((sum, n) => sum + n, 0) : null;
    const demand = district.history[month] ?? null;
    const projected = seasonalForecast(Object.fromEntries(Object.entries(district.history).filter(([key]) => key <= month)), nextMonth(month));
    const pressure = capacity && demand !== null ? demand / capacity : null;
    return { district, population, povertyRate, distanceKm, travelMinutes, access, capacity, demand, projected, pressure };
  });
  const territories: Territory[] = raw.map((item) => {
    const { district } = item;
    const neighbors = raw.filter((other) => district.neighborIds.includes(other.district.id));
    const validNeighbors = neighbors.filter((neighbor) => neighbor.pressure !== null);
    const neighborScore = validNeighbors.length ? validNeighbors.reduce((sum, neighbor) =>
      sum + Math.min(Math.max((neighbor.pressure! - 0.6), 0), 1), 0) / validNeighbors.length : 0;
    const priority = item.pressure !== null && item.access !== null
      ? DigitalTwinEngine.calculatePriorityIndex(item.povertyRate, item.pressure, item.access, 0.8 * neighborScore)
      : null;
    const category = priority === null ? 'Sin dato' : getHotspotCategory(priority);
    const byCategory: Record<string, number> = {};
    for (const facility of facilities.filter((f) => f.districtId === district.id && f.operationalStatus === 'Operativo'))
      byCategory[facility.category] = (byCategory[facility.category] ?? 0) + 1;
    const ring = district.geometry.type === 'Polygon' ? district.geometry.coordinates[0] : district.geometry.coordinates[0][0];
    return {
      id: district.id, code: district.code, name: district.name, department: 'La Libertad', province: 'Trujillo',
      population: item.population, density: item.population / district.areaKm2, areaKm2: district.areaKm2,
      povertyInterval: district.povertyInterval,
      elderlyPct: null, childrenPct: null,
      sdoh: { povertyRate: item.povertyRate, unemploymentRate: null, waterAccessDeficit: null,
        sanitationDeficit: null, overcrowdingRate: null, illiteracyRate: null, precariousHousingPct: null,
        vulnerabilityIndex: item.povertyRate, vulnerabilityQuintile: 1 },
      coordinates: district.coordinates, geometry: district.geometry,
      geoJsonCoords: [ring.map(([lng, lat]) => [lat, lng]) as [number, number][]],
      history: district.history, provenance: {
        ...district.provenance,
        population: { ...district.provenance.population, period: String(lastYear) },
        density: { ...district.provenance.density, period: `${lastYear}/2023` },
        historicalDemand: { ...district.provenance.historicalDemand, period: month },
        projectedDemand: { ...district.provenance.projectedDemand, period: nextMonth(month) },
        healthcareCapacity: { ...district.provenance.healthcareCapacity, period: `${nextMonth(month, -11)}–${month}` },
        systemPressure: { ...district.provenance.systemPressure, period: month },
        priorityIndex: { ...district.provenance.priorityIndex, period: month },
      },
      activeFacilitiesCount: facilities.filter((f) => f.districtId === district.id && f.operationalStatus === 'Operativo').length,
      facilitiesByCategory: byCategory, neighborIds: district.neighborIds,
      currentState: { monthKey: month, historicalDemand: item.demand, projectedDemand: item.projected,
        demandUncertaintyLower: item.projected, demandUncertaintyUpper: item.projected,
        accessibilityIndex: item.access, avgTravelTimeMinutes: item.travelMinutes,
        avgDistanceKm: item.distanceKm, healthcareCapacity: item.capacity,
        systemPressure: item.pressure, priorityIndex: priority, hotspotCategory: category,
        trendPct: 0, contagionRisk: neighborScore },
    };
  });
  const ordered = [...territories].sort((a, b) => a.sdoh.vulnerabilityIndex - b.sdoh.vulnerabilityIndex);
  ordered.forEach((district, index) => { district.sdoh.vulnerabilityQuintile = (Math.floor(index / 2) + 1) as 1 | 2 | 3 | 4 | 5; });
  const benchmarks = buildBenchmarks(territories, month);
  const equity = buildEquity(territories, facilities);
  return { version: snapshot.version, createdAt: snapshot.createdAt, checkedAt: snapshot.checkedAt, month, months: snapshot.months, territories, facilities,
    sources: snapshot.sources, warnings: snapshot.warnings, benchmarks, equity };
}

function buildBenchmarks(territories: Territory[], selectedMonth: string): AIModelBenchmark[] {
  const pairs: { actual: number; seasonal: number; last: number }[] = [];
  for (const territory of territories) {
    const history = territory.history ?? {};
    for (const month of Object.keys(history).filter((key) => key <= selectedMonth).sort()) {
      const seasonal = history[nextMonth(month, -12)], last = history[nextMonth(month, -1)];
      if (seasonal !== undefined && last !== undefined) pairs.push({ actual: history[month], seasonal, last });
    }
  }
  const metrics = (key: 'seasonal' | 'last') => {
    if (!pairs.length) return { mae: NaN, rmse: NaN, mape: NaN, r2: NaN };
    const meanActual = pairs.reduce((sum, row) => sum + row.actual, 0) / pairs.length;
    const errors = pairs.map((row) => row.actual - row[key]);
    const positive = pairs.filter((row) => row.actual > 0);
    const ssTotal = pairs.reduce((sum, row) => sum + (row.actual - meanActual) ** 2, 0);
    const ssResidual = errors.reduce((sum, error) => sum + error ** 2, 0);
    return { mae: errors.reduce((sum, error) => sum + Math.abs(error), 0) / errors.length,
      rmse: Math.sqrt(ssResidual / errors.length),
      mape: positive.length ? positive.reduce((sum, row) => sum + Math.abs(row.actual - row[key]) / row.actual, 0) / positive.length : NaN,
      r2: ssTotal ? 1 - ssResidual / ssTotal : NaN };
  };
  return [
    { id: 'seasonal', name: 'Persistencia estacional', version: '1', category: 'Referencia determinista',
      ...metrics('seasonal'), trainingDate: '', status: 'Activo',
      dataset: 'Consultas externas SIS 2024–2025', isStGnn: false, notes: `${pairs.length} predicciones retrospectivas` },
    { id: 'last', name: 'Persistencia del último mes', version: '1', category: 'Referencia determinista',
      ...metrics('last'), trainingDate: '', status: 'Benchmark',
      dataset: 'Consultas externas SIS 2024–2025', isStGnn: false, notes: `${pairs.length} predicciones retrospectivas` },
  ];
}

function buildEquity(territories: Territory[], facilities: HealthFacility[]): EquityMetric[] {
  return Array.from({ length: 5 }, (_, i) => {
    const districts = territories.filter((t) => t.sdoh.vulnerabilityQuintile === i + 1);
    const population = districts.reduce((sum, d) => sum + d.population, 0);
    const weighted = (fn: (t: Territory) => number | null) => {
      const available = districts.filter((district) => fn(district) !== null);
      const denominator = available.reduce((sum, district) => sum + district.population, 0);
      return denominator ? available.reduce((sum, district) => sum + fn(district)! * district.population, 0) / denominator : null;
    };
    return { quintile: i + 1, population,
      vulnerabilityDescription: i === 0 ? 'Menor pobreza' : i === 4 ? 'Mayor pobreza' : 'Pobreza intermedia',
      avgTravelTimeMinutes: weighted((t) => t.currentState.avgTravelTimeMinutes),
      facilitiesPer10kPop: population ? facilities.filter((f) => f.activitySis && f.operationalStatus === 'Operativo' && districts.some((d) => d.id === f.districtId)).length * 10000 / population : 0 } as EquityMetric;
  });
}
