export interface Territory {
  id: number;
  code: string;
  name: string;
  department: string;
  province: string;
  population: number;
  density: number; // hab/km2
  areaKm2: number;
  elderlyPct: number; // % >60 years
  childrenPct: number; // % <5 years
  // SDOH (Social Determinants of Health)
  sdoh: {
    povertyRate: number; // 0 - 1
    unemploymentRate: number; // 0 - 1
    waterAccessDeficit: number; // % without continuous potable water
    sanitationDeficit: number; // % without sewer system
    overcrowdingRate: number; // % homes with >3 pers/room
    illiteracyRate: number; // %
    precariousHousingPct: number; // %
    vulnerabilityIndex: number; // Composite 0 - 1
    vulnerabilityQuintile: 1 | 2 | 3 | 4 | 5;
  };
  // Geospatial center & bounds
  coordinates: {
    lat: number;
    lng: number;
  };
  geoJsonCoords: [number, number][][];
  // Health Infrastructure summary
  activeFacilitiesCount: number;
  facilitiesByCategory: Record<string, number>;
  // Dynamic monthly state (for currently selected month)
  currentState: TerritoryMonthlyMetrics;
  // Graph adjacency (neighbor district IDs)
  neighborIds: number[];
}

export interface TerritoryMonthlyMetrics {
  monthKey: string; // "2026-08"
  historicalDemand: number; // Consultations / month
  projectedDemand: number;
  demandUncertaintyLower: number;
  demandUncertaintyUpper: number;
  accessibilityIndex: number; // 0 to 1 (1 = optimal, 0 = isolated)
  avgTravelTimeMinutes: number; // min
  avgDistanceKm: number;
  healthcareCapacity: number; // capacity per month
  systemPressure: number; // demand / capacity (e.g. 1.15 = 15% overload)
  priorityIndex: number; // 0.00 to 1.00
  hotspotCategory: 'Bajo' | 'Medio' | 'Alto' | 'Crítico';
  trendPct: number; // vs previous month %
  contagionRisk: number; // 0 - 1
}

export interface HealthFacility {
  id: string;
  code: string;
  name: string;
  districtId: number;
  districtName: string;
  category: 'I-1' | 'I-2' | 'I-3' | 'I-4' | 'II-1' | 'II-2' | 'III-1';
  type: 'Puesto de Salud' | 'Centro de Salud' | 'Hospital Distrital' | 'Hospital Regional / Nacional';
  operationalStatus: 'Operativo' | 'Mantenimiento' | 'Sobrecargado' | 'Cierre Temporal';
  schedule: '12 horas' | '24 horas' | '6 horas';
  latitude: number;
  longitude: number;
  consultingRooms: number;
  staffCount: number;
  monthlyCapacity: number;
  currentMonthlyDemand: number;
  pressureRatio: number;
  isDemo: boolean;
  phone?: string;
  address: string;
}

export type InterventionType = 'new_facility' | 'expand_capacity' | 'improve_access' | 'temporary_closure';

export interface InterventionParams {
  type: InterventionType;
  name?: string;
  targetDistrictId: number;
  targetFacilityId?: string;
  // Params for new facility
  newFacilityName?: string;
  newFacilityCategory?: string;
  newFacilityCapacity?: number;
  newFacilitySchedule?: '12 horas' | '24 horas';
  newFacilityCoordinates?: { lat: number; lng: number };
  // Params for expansion
  capacityIncreasePct?: number;
  upgradedSchedule?: '12 horas' | '24 horas';
  // Params for access improvement
  travelTimeReductionPct?: number;
  roadInvestmentLevel?: 'Bajo' | 'Medio' | 'Alto';
  // Params for closure
  temporaryClosureFacilityId?: number;
  affectedFacilityId?: string;
  estimatedDurationMonths?: number;
}

export interface SimulationResult {
  id: string;
  scenarioName: string;
  createdAt: string;
  authorRole: string;
  params: InterventionParams;
  targetDistrict: Territory;
  before: {
    priorityIndex: number;
    accessibilityIndex: number;
    systemPressure: number;
    projectedDemand: number;
    hotspotCategory: string;
    avgTravelTimeMinutes: number;
    totalCoveragePop: number;
  };
  after: {
    priorityIndex: number;
    accessibilityIndex: number;
    systemPressure: number;
    projectedDemand: number;
    hotspotCategory: string;
    avgTravelTimeMinutes: number;
    totalCoveragePop: number;
  };
  deltas: {
    priorityDelta: number;
    priorityDeltaPct: number;
    accessibilityDelta: number;
    accessibilityDeltaPct: number;
    pressureDelta: number;
    pressureDeltaPct: number;
    travelTimeSavedMinutes: number;
  };
  affectedNeighbors: {
    districtId: number;
    districtName: string;
    pressureDeltaPct: number;
    priorityAfter: number;
  }[];
  verdict: string;
  aiExplanation?: string;
}

export interface AIModelBenchmark {
  id: string;
  name: string;
  version: string;
  category: string;
  mae: number;
  rmse: number;
  mape: number;
  r2: number;
  trainingDate: string;
  status: 'Activo' | 'Benchmark' | 'Candidato' | 'Deprecado';
  dataset: string;
  isStGnn: boolean;
  notes: string;
  isSelected?: boolean;
  description?: string;
  type?: string;
  trainingTime?: string;
}

export interface DataSourceItem {
  id: string;
  name: string;
  institution?: string;
  acronym?: string;
  sourceType?: string;
  description: string;
  lastUpdated?: string;
  lastSync?: string;
  recordsCount: number;
  status: string;
  coverageTemporal?: string;
  coverageSpatial?: string;
  frequency?: string;
  updateFrequency?: string;
}

export interface RiskFactorExplication {
  factor: string;
  category: 'SDOH' | 'Accesibilidad' | 'Demanda' | 'Infraestructura' | 'Espacial';
  weight: number; // percentage e.g. 0.35
  score: number; // 0 to 1
  impact: string;
  description: string;
}

export interface EquityMetric {
  quintile: string | number;
  vulnerabilityLabel?: string;
  vulnerabilityDescription?: string;
  population: number;
  districtCount?: number;
  mae?: number;
  rmse?: number;
  mape?: number;
  modelMae?: number;
  modelRmse?: number;
  avgTravelTime?: number;
  avgTravelTimeMinutes?: number;
  ipressPer10k?: number;
  facilitiesPer10kPop?: number;
  relativeErrorPct?: number;
}

/* -------------------------------------------------------------------------- */
/* Dictamen técnico estructurado                                                */
/* -------------------------------------------------------------------------- */

export type EstadoIndicador = 'critico' | 'alerta' | 'adecuado';

export interface IndicadorDictamen {
  grupo: string;
  indicador: string;
  valor: string;
  referencia: string;
  estado: EstadoIndicador;
}

export interface HallazgoDictamen {
  titulo: string;
  detalle: string;
  severidad: 'alta' | 'media' | 'baja';
}

export interface RecomendacionDictamen {
  prioridad: number;
  accion: string;
  tipo: string;
  justificacion: string;
  plazo: string;
}

/** Parte redactada (por el agente o por reglas). Nunca contiene las tablas. */
export interface DictamenNarrativa {
  resumenEjecutivo: string;
  hallazgos: HallazgoDictamen[];
  recomendaciones: RecomendacionDictamen[];
  efectoRed: string;
  limitaciones: string[];
}

export interface DictamenTecnico {
  codigo: string;
  fechaEmision: string;
  periodo: string;
  distrito: {
    id: number;
    nombre: string;
    ubigeo: string;
    provincia: string;
    departamento: string;
    poblacion: number;
    areaKm2: number;
  };
  clasificacion: {
    prioridad: number;
    categoria: string;
    quintil: number;
    rankingMetropolitano: number;
    totalDistritos: number;
  };
  /** Todo lo numérico sale del motor del gemelo, nunca del modelo de lenguaje. */
  indicadores: IndicadorDictamen[];
  factoresRiesgo: {
    factor: string;
    categoria: string;
    peso: number;
    puntuacion: number;
    impacto: string;
  }[];
  ipress: {
    nombre: string;
    categoria: string;
    estado: string;
    horario: string;
    capacidad: number;
    demanda: number;
    carga: number;
  }[];
  vecinos: { nombre: string; prioridad: number; categoria: string; presion: number }[];
  narrativa: DictamenNarrativa;
  notaEtica: string;
  fuente: {
    origen: 'langchain-agent' | 'reglas';
    modelo: string;
    motor: string;
  };
}
