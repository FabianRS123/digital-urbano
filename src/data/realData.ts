import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, readFileSync, statSync } from 'node:fs';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import ExcelJS from 'exceljs';
import { parse as parseCsv } from 'csv-parse';
import { parse as parseCsvSync } from 'csv-parse/sync';
import yauzl from 'yauzl';
import { area, booleanIntersects, centerOfMass, feature } from '@turf/turf';
import { DISTRICTS, OFFICIAL_SOURCES, SIS_ARCHIVES } from './officialSources';

export type MetricOrigin = 'publicado' | 'estimado' | 'derivado' | 'no disponible';
export interface MetricProvenance { origin: MetricOrigin; sourceIds: string[]; period: string; method?: string }
export interface SourceRecord {
  id: string; name: string; institution: string; pageUrl: string; resourceUrl: string;
  resourceUrls?: string[];
  period: string; fetchedAt: string; recordsCount: number; rejectedCount: number;
  status: 'Sincronizado' | 'Error'; etag?: string | null;
}
export interface ObservedFacility {
  id: string; code: string; name: string; districtId: number; districtName: string;
  category: string; institution: string; classification: string;
  operationalStatus: string; schedule: string; latitude: number | null; longitude: number | null;
  phone: string; address: string; monthlyCapacity: number | null; currentMonthlyDemand: number | null;
  pressureRatio: number | null; consultingRooms: null; staffCount: null; isDemo: false;
  activitySis: boolean; type: string; capacityMethod?: string;
}
export interface DistrictBase {
  id: number; code: string; name: string; populationByYear: Record<string, number>;
  povertyInterval: [number, number]; geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  coordinates: { lat: number; lng: number }; areaKm2: number; neighborIds: number[];
  history: Record<string, number>; facilityHistory: Record<string, Record<string, number>>;
  provenance: Record<string, MetricProvenance>;
}
export interface RealSnapshot {
  version: string; createdAt: string; checkedAt: string; months: string[];
  sources: SourceRecord[]; districts: DistrictBase[]; facilities: ObservedFacility[];
  warnings: string[]; counts: { sisRows: number; sisRejected: number; sisMatched: number; sisAtenciones: number };
}

const SNAPSHOT_PATH = path.resolve('data/official-snapshot.json');
const CACHE_PATH = path.resolve('.cache/official-snapshot.json');
const CODES = new Set<string>(DISTRICTS.map((d) => d.code));

function cell(row: ExcelJS.Row, index: number): string { return String(row.getCell(index).text ?? '').trim(); }
function numeric(value: unknown): number { return Number(String(value ?? '').replaceAll(',', '.')); }
function normalizedCode(value: unknown, digits: number): string { return String(value ?? '').trim().replace(/\.0$/, '').padStart(digits, '0'); }
function ipressCode(value: unknown): string {
  const raw = String(value ?? '').trim().replace(/\.0$/, '');
  if (!/^\d{1,10}$/.test(raw)) return '';
  const canonical = raw.replace(/^0+/, '') || '0';
  return canonical.length <= 8 ? canonical.padStart(8, '0') : '';
}

async function getBytes(url: string): Promise<{ bytes: Buffer; etag: string | null }> {
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return { bytes: Buffer.from(await response.arrayBuffer()), etag: response.headers.get('etag') };
}
function sourceRecord(id: keyof typeof OFFICIAL_SOURCES, count: number, rejected: number, etag: string | null): SourceRecord {
  return { ...OFFICIAL_SOURCES[id], resourceUrls: id === 'sis' ? SIS_ARCHIVES : [OFFICIAL_SOURCES[id].resourceUrl], fetchedAt: new Date().toISOString(), recordsCount: count,
    rejectedCount: rejected, status: 'Sincronizado', etag };
}

async function loadPopulation() {
  const { bytes, etag } = await getBytes(OFFICIAL_SOURCES.population.resourceUrl);
  const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes as any);
  const result = new Map<string, Record<string, number>>();
  const sheet = book.worksheets[0];
  sheet.eachRow((row, index) => {
    if (index < 7) return;
    const code = cell(row, 1);
    if (!CODES.has(code)) return;
    const values: Record<string, number> = {};
    for (let year = 2018; year <= 2026; year++) {
      const population = numeric(row.getCell(year - 2015).value);
      if (Number.isInteger(population) && population > 0) values[String(year)] = population;
    }
    result.set(code, values);
  });
  if (result.size !== DISTRICTS.length) throw new Error(`INEI población: ${result.size}/10 distritos`);
  for (const [code, years] of result) if (Object.keys(years).length !== 9)
    throw new Error(`INEI población: faltan años para ${code}`);
  return { data: result, source: sourceRecord('population', result.size, 0, etag) };
}

async function loadPoverty() {
  const { bytes, etag } = await getBytes(OFFICIAL_SOURCES.poverty.resourceUrl);
  const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes as any);
  const sheet = book.getWorksheet('Anexo2');
  if (!sheet) throw new Error('INEI pobreza: falta Anexo2');
  const result = new Map<string, [number, number]>();
  sheet.eachRow((row) => {
    const code = cell(row, 1);
    if (!CODES.has(code) || cell(row, 2) !== '000') return;
    const low = numeric(row.getCell(5).value), high = numeric(row.getCell(6).value);
    if (Number.isFinite(low) && Number.isFinite(high) && low <= high) result.set(code, [low, high]);
  });
  if (result.size !== DISTRICTS.length) throw new Error(`INEI pobreza: ${result.size}/10 distritos`);
  return { data: result, source: sourceRecord('poverty', result.size, 0, etag) };
}

async function loadBoundaries() {
  const { bytes, etag } = await getBytes(OFFICIAL_SOURCES.boundaries.resourceUrl);
  const collection = JSON.parse(bytes.toString('utf8')) as GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, { ubigeo: string }>;
  const result = new Map<string, GeoJSON.Polygon | GeoJSON.MultiPolygon>();
  for (const feature of collection.features) {
    const code = feature.properties.ubigeo;
    if (CODES.has(code) && ['Polygon', 'MultiPolygon'].includes(feature.geometry.type)) result.set(code, feature.geometry);
  }
  if (result.size !== DISTRICTS.length) throw new Error(`Límites: ${result.size}/10 distritos`);
  return { data: result, source: sourceRecord('boundaries', result.size, 0, etag) };
}

async function loadFacilities() {
  const { bytes, etag } = await getBytes(OFFICIAL_SOURCES.renipress.resourceUrl);
  const records = parseCsvSync(bytes.toString('utf8'), { columns: true, bom: true, delimiter: ';',
    skip_empty_lines: true, relax_quotes: true, relax_column_count: true }) as Record<string, string>[];
  const byCode = new Map<string, ObservedFacility>();
  let rejected = 0, invalidCoordinates = 0, duplicates = 0;
  for (const row of records) {
    const code = normalizedCode(row.UBIGEO, 6);
    if (!CODES.has(code)) continue;
    const district = DISTRICTS.find((d) => d.code === code)!;
    const ipress = ipressCode(row.COD_IPRESS);
    if (!/^\d{8}$/.test(ipress)) { rejected++; continue; }
    if (byCode.has(ipress)) { duplicates++; rejected++; continue; }
    const latitude = numeric(row.NORTE), longitude = numeric(row.ESTE);
    const coordinatesValid = latitude >= -9 && latitude <= -7 && longitude >= -80 && longitude <= -78;
    if (!coordinatesValid) invalidCoordinates++;
    const category = String(row.CATEGORIA ?? '').trim();
    byCode.set(ipress, {
      id: ipress, code: ipress, name: row.NOMBRE?.trim() || `IPRESS ${ipress}`,
      districtId: district.id, districtName: district.name, category,
      institution: row.INSTITUCION?.trim() || 'Sin institución', classification: row.CLASIFICACION?.trim() || '',
      operationalStatus: row.ESTADO === 'ACTIVO' ? 'Operativo' : row.ESTADO?.trim() || 'No disponible',
      schedule: row.HORARIO?.trim() || 'No disponible',
      latitude: coordinatesValid ? latitude : null, longitude: coordinatesValid ? longitude : null,
      phone: row.TELEFONO?.trim() || '', address: row.DIRECCION?.trim() || '',
      monthlyCapacity: null, currentMonthlyDemand: null, pressureRatio: null,
      consultingRooms: null, staffCount: null, isDemo: false, activitySis: false,
      type: row.TIPO_ESTABLECIMIENTO?.trim() || 'Establecimiento de salud',
    });
  }
  if (byCode.size < 20) throw new Error(`RENIPRESS: solo ${byCode.size} IPRESS`);
  return { data: [...byCode.values()], source: sourceRecord('renipress', byCode.size, rejected, etag), invalidCoordinates, duplicates };
}

async function downloadArchive(url: string, destination: string): Promise<{ etag: string | null; modified: string | null; length: string | null }> {
  const response = await fetch(url, { signal: AbortSignal.timeout(600_000) });
  if (!response.ok || !response.body) throw new Error(`SIS: HTTP ${response.status} ${url}`);
  await pipeline(Readable.fromWeb(response.body as any), createWriteStream(destination));
  return { etag: response.headers.get('etag'), modified: response.headers.get('last-modified'), length: response.headers.get('content-length') };
}
async function archiveValidators(url: string): Promise<{ etag: string | null; modified: string | null; length: string | null } | null> {
  try {
    const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(30_000) });
    if (!response.ok) return null;
    return { etag: response.headers.get('etag'), modified: response.headers.get('last-modified'), length: response.headers.get('content-length') };
  } catch { return null; }
}

async function readSisArchive(file: string, history: Map<string, Map<string, number>>, byFacility: Map<string, Map<string, number>>) {
  return new Promise<{ rows: number; matched: number; rejected: number; atenciones: number }>((resolve, reject) => {
    yauzl.open(file, { lazyEntries: true }, (error, zip) => {
      if (error || !zip) return reject(error ?? new Error('ZIP SIS vacío'));
      const counts = { rows: 0, matched: 0, rejected: 0, atenciones: 0 };
      let finished = false;
      const fail = (cause: Error) => { if (!finished) { finished = true; zip.close(); reject(cause); } };
      zip.on('error', fail);
      zip.on('end', () => { if (!finished) { finished = true; resolve(counts); } });
      zip.on('entry', (entry) => {
        if (!/\.(csv|txt)$/i.test(entry.fileName)) { zip.readEntry(); return; }
        zip.openReadStream(entry, async (streamError, stream) => {
          if (streamError || !stream) return fail(streamError ?? new Error('SIS: archivo interior vacío'));
          try {
            const parser = stream.pipe(parseCsv({ columns: true, bom: true, delimiter: [',', ';', '\t'],
              skip_empty_lines: true, relax_column_count: true, relax_quotes: true }));
            for await (const raw of parser) {
              counts.rows++;
              const row = raw as Record<string, string>;
              if (counts.rows === 1 && process.env.GDUS_DEBUG_SIS === '1') console.log('SIS sample', JSON.stringify(row).slice(0, 1500));
              const year = Number(row['AÑO'] ?? row.ANO), month = Number(row.MES);
              const districtCode = normalizedCode(row.UBIGEO_DISTRITO, 6);
              if (!CODES.has(districtCode) || ![2024, 2025].includes(year) || !(month >= 1 && month <= 12)) continue;
              if (Number(row.COD_SERVICIO) !== 56) continue;
              const amount = Number(row.ATENCIONES);
              if (!Number.isSafeInteger(amount) || amount < 0) { counts.rejected++; continue; }
              counts.atenciones += amount;
              const key = `${year}-${String(month).padStart(2, '0')}`;
              const district = history.get(districtCode) ?? new Map<string, number>();
              district.set(key, (district.get(key) ?? 0) + amount); history.set(districtCode, district);
              const ipress = ipressCode(row.COD_IPRESS);
              if (/^\d{8}$/.test(ipress)) {
                const facilityKey = `${districtCode}:${ipress}`;
                const facility = byFacility.get(facilityKey) ?? new Map<string, number>();
                facility.set(key, (facility.get(key) ?? 0) + amount); byFacility.set(facilityKey, facility);
              } else counts.rejected++;
              counts.matched++;
            }
            zip.readEntry();
          } catch (cause) { fail(cause as Error); }
        });
      });
      zip.readEntry();
    });
  });
}

async function loadSis(onProgress?: (progress: string) => void) {
  const history = new Map<string, Map<string, number>>();
  const byFacility = new Map<string, Map<string, number>>();
  const counts = { rows: 0, matched: 0, rejected: 0, atenciones: 0 };
  const dir = path.resolve('.cache/sis'); await mkdir(dir, { recursive: true });
  for (const [index, url] of SIS_ARCHIVES.entries()) {
    const file = path.join(dir, `sis-${index}.zip`);
    const metadataFile = `${file}.meta.json`;
    try {
      const current = existsSync(file) ? await archiveValidators(url) : null;
      const cached = existsSync(metadataFile) ? JSON.parse(readFileSync(metadataFile, 'utf8')) as Awaited<ReturnType<typeof archiveValidators>> : null;
      const same = current && existsSync(file) && (cached
        ? (current.etag || current.modified) && current.etag === cached.etag && current.modified === cached.modified && current.length === cached.length
        : current.length && Number(current.length) === statSync(file).size);
      if (same && !cached) await writeFile(metadataFile, JSON.stringify(current));
      if (!existsSync(file) || !same) {
        onProgress?.(`Descargando SIS ${index + 1}/${SIS_ARCHIVES.length}`);
        const partial = `${file}.${process.pid}.part`;
        try { const metadata = await downloadArchive(url, partial); await rename(partial, file);
          await writeFile(metadataFile, JSON.stringify(metadata)); }
        finally { await rm(partial, { force: true }); }
      }
      onProgress?.(`Procesando SIS ${index + 1}/${SIS_ARCHIVES.length}`);
      const part = await readSisArchive(file, history, byFacility);
      for (const key of Object.keys(counts) as (keyof typeof counts)[]) counts[key] += part[key];
    } finally { /* El ZIP descargado queda en caché para reintentos y comprobaciones. */ }
    if (process.env.GDUS_SIS_LIMIT === '1') break;
  }
  if (counts.matched < 100) throw new Error(`SIS: solo ${counts.matched} filas útiles`);
  const archiveVersions = SIS_ARCHIVES.map((_, index) => {
    const metadata = JSON.parse(readFileSync(path.join(dir, `sis-${index}.zip.meta.json`), 'utf8')) as { etag?: string; modified?: string; length?: string };
    return metadata.etag ?? `${metadata.modified ?? ''}:${metadata.length ?? ''}`;
  });
  return { history, byFacility, counts,
    source: sourceRecord('sis', counts.matched, counts.rejected, createHash('sha256').update(archiveVersions.join('|')).digest('hex').slice(0, 16)) };
}

function meanPoint(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): { lat: number; lng: number } {
  const [lng, lat] = centerOfMass(feature(geometry)).geometry.coordinates;
  return { lat, lng };
}

export async function buildOfficialSnapshot(onProgress?: (progress: string) => void): Promise<RealSnapshot> {
  onProgress?.('Leyendo fuentes INEI y RENIPRESS');
  const [population, poverty, boundaries, facilities] = await Promise.all([
    loadPopulation(), loadPoverty(), loadBoundaries(), loadFacilities(),
  ]);
  const sis = await loadSis(onProgress);
  const months = [...new Set([...sis.history.values()].flatMap((items) => [...items.keys()]))].sort();
  if (months.length < 18) throw new Error(`SIS: solo ${months.length} meses de cobertura`);
  const totalAtenciones = [...sis.history.values()].reduce((sum, history) =>
    sum + [...history.values()].reduce((districtSum, amount) => districtSum + amount, 0), 0);
  if (totalAtenciones !== sis.counts.atenciones) throw new Error(`SIS: suma inconsistente ${totalAtenciones} != ${sis.counts.atenciones}`);
  const districts: DistrictBase[] = DISTRICTS.map((district) => {
    const geometry = boundaries.data.get(district.code)!;
    return {
      ...district, populationByYear: population.data.get(district.code)!,
      povertyInterval: poverty.data.get(district.code)!, geometry,
      coordinates: meanPoint(geometry), areaKm2: area(feature(geometry)) / 1_000_000, neighborIds: [],
      history: Object.fromEntries(sis.history.get(district.code) ?? []),
      facilityHistory: Object.fromEntries(facilities.data.filter((f) => f.districtId === district.id)
        .map((f) => [f.code, Object.fromEntries(sis.byFacility.get(`${district.code}:${f.code}`) ?? [])])),
      provenance: {
        population: { origin: 'publicado', sourceIds: ['population'], period: '2025' },
        density: { origin: 'derivado', sourceIds: ['population', 'boundaries'], period: '2025/2023', method: 'Población / área de geometría distrital' },
        activeFacilitiesCount: { origin: 'derivado', sourceIds: ['renipress'], period: '2026-08', method: 'Conteo de IPRESS con estado activo' },
        povertyRate: { origin: 'derivado', sourceIds: ['poverty'], period: '2018', method: 'Punto medio del intervalo de confianza del 95 %' },
        historicalDemand: { origin: 'publicado', sourceIds: ['sis'], period: months.at(-1)!, method: 'Suma de ATENCIONES, COD_SERVICIO=56' },
        projectedDemand: { origin: 'estimado', sourceIds: ['sis'], period: nextMonthLabel(months.at(-1)!), method: 'Persistencia estacional' },
        accessibilityIndex: { origin: 'estimado', sourceIds: ['boundaries', 'renipress'], period: '2023/2026-08', method: 'Distancia geográfica × 1,3; 20 km/h; 5 min fijos; A=exp(-t/30)' },
        avgTravelTimeMinutes: { origin: 'estimado', sourceIds: ['boundaries', 'renipress'], period: '2023/2026-08', method: 'Distancia geográfica × 1,3 / 20 km/h + 5 min' },
        healthcareCapacity: { origin: 'estimado', sourceIds: ['sis', 'renipress'], period: 'últimos 12 meses', method: 'Percentil 95 de consultas SIS por IPRESS' },
        systemPressure: { origin: 'derivado', sourceIds: ['sis', 'renipress'], period: months.at(-1)!, method: 'Consultas externas SIS / capacidad de referencia estimada' },
        priorityIndex: { origin: 'derivado', sourceIds: ['sis', 'poverty', 'renipress', 'boundaries'], period: months.at(-1)!, method: 'Ponderación de pobreza, presión, acceso y vecinos' },
        unemploymentRate: { origin: 'no disponible', sourceIds: [], period: '', method: 'Sin fuente integrada' },
        waterAccessDeficit: { origin: 'no disponible', sourceIds: [], period: '', method: 'Sin fuente integrada' },
        sanitationDeficit: { origin: 'no disponible', sourceIds: [], period: '', method: 'Sin fuente integrada' },
        overcrowdingRate: { origin: 'no disponible', sourceIds: [], period: '', method: 'Sin fuente integrada' },
        illiteracyRate: { origin: 'no disponible', sourceIds: [], period: '', method: 'Sin fuente integrada' },
        precariousHousingPct: { origin: 'no disponible', sourceIds: [], period: '', method: 'Sin fuente integrada' },
      },
    };
  });
  for (const district of districts) district.neighborIds = districts
    .filter((other) => other.id !== district.id && booleanIntersects(feature(district.geometry), feature(other.geometry)))
    .map((other) => other.id);
  if (districts.some((district) => !Number.isFinite(district.areaKm2) || district.areaKm2 <= 0))
    throw new Error('Límites: geometría con área nula o inválida');
  const missingMonths = districts.flatMap((district) => months.filter((month) => district.history[month] === undefined)
    .map((month) => `${district.code}:${month}`));
  const raw = JSON.stringify({ districts, facilities: facilities.data, months });
  const now = new Date().toISOString();
  return { version: createHash('sha256').update(raw).digest('hex').slice(0, 16), createdAt: now,
    checkedAt: now, months, sources: [population.source, poverty.source, boundaries.source, facilities.source, sis.source],
    districts, facilities: facilities.data,
    warnings: [`SIS: ${missingMonths.length} pares distrito-mes sin registro, conservados como ausentes.`,
      `RENIPRESS: ${facilities.invalidCoordinates} IPRESS sin coordenadas válidas; ${facilities.duplicates} códigos duplicados rechazados.`,
      'Atenciones SIS: solo asegurados SIS; capacidad, accesibilidad y escenarios son estimaciones.',
      'Se excluyen Simbal (130110) y Alto Trujillo (130112). Las fuentes tienen periodos distintos.'],
    counts: { sisRows: sis.counts.rows, sisRejected: sis.counts.rejected, sisMatched: sis.counts.matched, sisAtenciones: sis.counts.atenciones } };
}

function nextMonthLabel(month: string): string {
  const [year, value] = month.split('-').map(Number);
  return value === 12 ? `${year + 1}-01` : `${year}-${String(value + 1).padStart(2, '0')}`;
}

export function readOfficialSnapshot(): RealSnapshot | null {
  for (const file of [CACHE_PATH, SNAPSHOT_PATH]) {
    if (!existsSync(file)) continue;
    try {
      const snapshot = JSON.parse(readFileSync(file, 'utf8')) as RealSnapshot;
      if (snapshot.version && snapshot.districts.length === 10 && snapshot.months.length >= 18 && snapshot.facilities.length > 20)
        return snapshot;
    } catch { /* Se intenta la copia inicial válida. */ }
  }
  return null;
}
export async function saveOfficialSnapshot(snapshot: RealSnapshot, checkedIn = false): Promise<void> {
  const destination = checkedIn ? SNAPSHOT_PATH : CACHE_PATH;
  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(snapshot));
  await rename(temporary, destination);
}
