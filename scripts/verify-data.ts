import assert from 'node:assert/strict';
import { buildOfficialSnapshot, readOfficialSnapshot } from '../src/data/realData';
import { buildModelView } from '../src/lib/officialModel';
import { DigitalTwinEngine } from '../src/lib/simulationEngine';
import { construirDictamenBase } from '../src/lib/dictamen';
import { generateDistrictTimeSeries } from '../src/lib/spatiotemporalGnn';

const snapshot = readOfficialSnapshot();
assert(snapshot, 'Falta copia oficial procesada');
assert.equal(snapshot.districts.length, 10);
assert.equal(snapshot.months[0], '2024-01');
assert.equal(snapshot.months.at(-1), '2025-12');
assert.equal(snapshot.months.length, 24);
assert.equal(snapshot.sources.length, 5);
assert(!snapshot.districts.some((district) => ['130110', '130112'].includes(district.code)));
assert.equal(snapshot.districts.find((district) => district.name === 'Huanchaco')?.code, '130104');
assert.equal(snapshot.districts.find((district) => district.name === 'Florencia de Mora')?.code, '130103');

const ids = new Set<string>();
for (const facility of snapshot.facilities) {
  assert.match(facility.code, /^\d{8}$/);
  assert(!ids.has(facility.code), `IPRESS duplicada ${facility.code}`); ids.add(facility.code);
  assert.equal(snapshot.districts.find((district) => district.id === facility.districtId)?.name, facility.districtName);
  if (facility.latitude !== null || facility.longitude !== null) {
    assert(facility.latitude !== null && facility.longitude !== null);
    assert(facility.latitude >= -9 && facility.latitude <= -7);
    assert(facility.longitude >= -80 && facility.longitude <= -78);
  }
}
for (const district of snapshot.districts) {
  assert.match(district.code, /^\d{6}$/);
  assert(['Polygon', 'MultiPolygon'].includes(district.geometry.type));
  assert(district.areaKm2 > 0);
  const rings = district.geometry.type === 'Polygon' ? district.geometry.coordinates : district.geometry.coordinates.flat();
  for (const ring of rings) assert.deepEqual(ring[0], ring.at(-1), `Anillo sin cerrar: ${district.code}`);
  for (const neighborId of district.neighborIds) {
    const neighbor = snapshot.districts.find((item) => item.id === neighborId);
    assert(neighbor && neighbor.neighborIds.includes(district.id), `Vecindad asimétrica ${district.code}`);
  }
}
const sum = snapshot.districts.reduce((total, district) => total + Object.values(district.history).reduce((part, value) => part + value, 0), 0);
assert.equal(sum, snapshot.counts.sisAtenciones);
const view = buildModelView(snapshot);
for (const territory of view.territories) {
  const state = territory.currentState;
  if (state.priorityIndex !== null) {
    assert.equal(state.priorityIndex, DigitalTwinEngine.calculatePriorityIndex(territory.sdoh.povertyRate, state.systemPressure!, state.accessibilityIndex!, state.contagionRisk * .8));
    const dictamen = construirDictamenBase(territory, view.territories, view.facilities);
    assert.equal(dictamen.periodo, view.month);
    assert.equal(dictamen.clasificacion.prioridad, state.priorityIndex);
  }
}
const historical = buildModelView(snapshot, '2024-01').territories[0];
assert(generateDistrictTimeSeries(historical, 1).filter((point) => !point.isForecast).every((point) => point.monthKey <= '2024-01'));

const oldFetch = globalThis.fetch;
try {
  globalThis.fetch = async () => { throw new Error('Caída simulada de fuente'); };
  await assert.rejects(buildOfficialSnapshot(), /Caída simulada de fuente/);
} finally { globalThis.fetch = oldFetch; }
assert.equal(readOfficialSnapshot()?.version, snapshot.version, 'La caída sobrescribió la última copia válida');
console.log(JSON.stringify({ version: snapshot.version, districts: snapshot.districts.length, facilities: snapshot.facilities.length,
  months: snapshot.months.length, sisAtenciones: sum, missingCoordinates: snapshot.facilities.filter((item) => item.latitude === null).length,
  status: 'validado' }, null, 2));
