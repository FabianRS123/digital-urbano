import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { readOfficialSnapshot } from '../src/data/realData';
import { buildModelView } from '../src/lib/officialModel';
import { DigitalTwinEngine } from '../src/lib/simulationEngine';
import { getHotspotCategory } from '../src/lib/riskThresholds';
import { construirDictamenBase, narrativaPorReglas } from '../src/lib/dictamen';
import { INITIAL_DISTRICTS, INITIAL_FACILITIES } from '../research/fixtures/trujilloPrototype';
import type { InterventionParams, SimulationResult, Territory } from '../src/types';

const snapshot = readOfficialSnapshot();
if (!snapshot) throw new Error('Falta la copia oficial. Ejecuta pnpm data:sync -- --seed.');
const requestedVersion = process.argv.find((arg) => arg.startsWith('--version='))?.split('=')[1];
if (requestedVersion && requestedVersion !== snapshot.version) throw new Error(`Versión solicitada ${requestedVersion}; disponible ${snapshot.version}`);
const view = buildModelView(snapshot);
const territories = view.territories;
const valid = territories.filter((t) => t.currentState.priorityIndex !== null && t.currentState.systemPressure !== null && t.currentState.accessibilityIndex !== null);
const output = `research/results/${snapshot.version}`;
await mkdir(output, { recursive: true });

function rng(seed: number) { let state = seed >>> 0; return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296); }
function quantile(values: number[], p: number) { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.floor((sorted.length - 1) * p)]; }
function mean(values: number[]) { return values.reduce((sum, item) => sum + item, 0) / values.length; }
function populationMean(rows: Territory[], of: (row: Territory) => number) { const total = rows.reduce((sum, item) => sum + item.population, 0); return rows.reduce((sum, item) => sum + item.population * of(item), 0) / total; }
function concentration(rows: Territory[], of: (row: Territory) => number) {
  const sorted = [...rows].sort((a, b) => a.sdoh.povertyRate - b.sdoh.povertyRate);
  const total = sorted.reduce((sum, row) => sum + row.population, 0);
  const avg = populationMean(sorted, of); if (avg === 0) return null;
  let cumulative = 0, weighted = 0;
  for (const row of sorted) { const share = row.population / total; const rank = cumulative + share / 2; weighted += share * of(row) * rank; cumulative += share; }
  return 2 * weighted / avg - 1;
}
function csv(rows: Record<string, unknown>[]) {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  return [keys, ...rows.map((row) => keys.map((key) => row[key]))].map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n') + '\n';
}

// RQ1: misma línea base para interfaz, API y motor; cuatro intervenciones por distrito.
const baseline = valid.map((t) => ({
  code: t.code, district: t.name, stored: t.currentState.priorityIndex!,
  recalculated: DigitalTwinEngine.calculatePriorityIndex(t.sdoh.vulnerabilityIndex, t.currentState.systemPressure!, t.currentState.accessibilityIndex!, t.currentState.contagionRisk * .8),
}));
const scenarios: { district: string; code: string; intervention: string; before: number; after: number; delta: number; neighbors: number; consistent: boolean; expectedDirection: boolean }[] = [];
const rawResults: SimulationResult[] = [];
for (const territory of valid) {
  for (const type of ['new_facility', 'expand_capacity', 'improve_access', 'temporary_closure'] as const) {
    const params: InterventionParams = { type, targetDistrictId: territory.id };
    const result = DigitalTwinEngine.runSimulation(territories, view.facilities, params, `RQ1 ${type} ${territory.name}`);
    rawResults.push(result);
    const recomputed = DigitalTwinEngine.calculatePriorityIndex(territory.sdoh.vulnerabilityIndex, result.after.systemPressure, result.after.accessibilityIndex, territory.currentState.contagionRisk * .8);
    const delta = result.after.priorityIndex - result.before.priorityIndex;
    scenarios.push({ district: territory.name, code: territory.code, intervention: type, before: result.before.priorityIndex,
      after: result.after.priorityIndex, delta, neighbors: result.affectedNeighbors.length,
      consistent: result.before.priorityIndex === territory.currentState.priorityIndex && result.after.priorityIndex === recomputed,
      expectedDirection: type === 'temporary_closure' ? delta >= 0 : delta <= 0 });
  }
}
const parityInputs = [
  ...valid.map((t) => [t.sdoh.vulnerabilityIndex, t.currentState.systemPressure!, t.currentState.accessibilityIndex!, t.currentState.contagionRisk * .8]),
  ...rawResults.map((r) => [r.targetDistrict.sdoh.vulnerabilityIndex, r.after.systemPressure, r.after.accessibilityIndex, r.targetDistrict.currentState.contagionRisk * .8]),
];
const python = spawnSync(process.env.PYTHON ?? 'python', ['scripts/priority-parity.py'], { input: JSON.stringify(parityInputs), encoding: 'utf8' });
const pythonValues: number[] = python.status === 0 ? JSON.parse(python.stdout) : [];
const tsValues = parityInputs.map(([v, p, a, s]) => DigitalTwinEngine.calculatePriorityIndex(v, p, a, s));
const rq1 = { baselineCases: baseline.length, baselineMismatch: baseline.filter((r) => r.stored !== r.recalculated).length,
  scenarios: scenarios.length, scenarioMismatch: scenarios.filter((r) => !r.consistent).length,
  metamorphicViolations: scenarios.filter((r) => !r.expectedDirection).length,
  pythonCases: pythonValues.length, pythonMismatch: pythonValues.filter((item, index) => item !== tsValues[index]).length,
  pythonError: python.status === 0 ? null : python.stderr || python.error?.message };
const fixtureDefects = INITIAL_DISTRICTS.map((district) => {
  const stored = district.currentState.priorityIndex;
  const recalculated = DigitalTwinEngine.calculatePriorityIndex(district.sdoh.vulnerabilityIndex,
    district.currentState.systemPressure, district.currentState.accessibilityIndex, district.currentState.contagionRisk * .8);
  const params: InterventionParams = { type: 'temporary_closure', targetDistrictId: district.id };
  const withStored = DigitalTwinEngine.runSimulation(INITIAL_DISTRICTS, INITIAL_FACILITIES, params);
  const corrected = INITIAL_DISTRICTS.map((item) => item.id === district.id
    ? { ...item, currentState: { ...item.currentState, priorityIndex: recalculated } } : item);
  const withCorrected = DigitalTwinEngine.runSimulation(corrected, INITIAL_FACILITIES, params);
  return { district: district.name, stored, recalculated, discrepancy: stored - recalculated,
    closureDeltaStored: withStored.deltas.priorityDelta, closureDeltaCorrected: withCorrected.deltas.priorityDelta };
});

// RQ2: concentración ponderada por población, pobreza como orden socioeconómico.
const measures = {
  accessDeficit: (t: Territory) => 1 - (t.currentState.accessibilityIndex ?? 0),
  travelMinutes: (t: Territory) => t.currentState.avgTravelTimeMinutes ?? 0,
  pressure: (t: Territory) => t.currentState.systemPressure ?? 0,
  facilitiesPer10k: (t: Territory) => view.facilities.filter((f) => f.districtId === t.id && f.activitySis && f.operationalStatus === 'Operativo').length * 10000 / t.population,
};
const bootRng = rng(1);
const concentrationRows = Object.entries(measures).map(([indicator, measure]) => {
  const replicates: number[] = [];
  for (let sample = 0; sample < 5000; sample++) {
    const drawn = Array.from({ length: valid.length }, () => valid[Math.floor(bootRng() * valid.length)]);
    const value = concentration(drawn, measure); if (value !== null) replicates.push(value);
  }
  const q1 = valid.filter((t) => t.sdoh.vulnerabilityQuintile === 1);
  const q5 = valid.filter((t) => t.sdoh.vulnerabilityQuintile === 5);
  const first = populationMean(q1, measure), fifth = populationMean(q5, measure);
  return { indicator, concentration: concentration(valid, measure), ciLow: quantile(replicates, .025), ciHigh: quantile(replicates, .975),
    q1: first, q5: fifth, q5OverQ1: first ? fifth / first : null, bootstrapReplicates: replicates.length };
});
function comparisonMetrics(target: Territory, result: SimulationResult, propagate: boolean) {
  const modified: Territory[] = valid.map((item): Territory => {
    if (item.id === target.id) return { ...item, currentState: { ...item.currentState,
      priorityIndex: result.after.priorityIndex, accessibilityIndex: result.after.accessibilityIndex,
      systemPressure: result.after.systemPressure, hotspotCategory: result.after.hotspotCategory as Territory['currentState']['hotspotCategory'] } };
    const neighbor = propagate ? result.affectedNeighbors.find((n) => n.districtId === item.id) : null;
    if (!neighbor || item.currentState.systemPressure === null) return item;
    return { ...item, currentState: { ...item.currentState,
      systemPressure: item.currentState.systemPressure * (1 + neighbor.pressureDeltaPct / 100),
      priorityIndex: neighbor.priorityAfter, hotspotCategory: getHotspotCategory(neighbor.priorityAfter) } };
  });
  const highPopulation = (rows: Territory[]) => rows.filter((item) => item.currentState.hotspotCategory === 'Alto' || item.currentState.hotspotCategory === 'Crítico').reduce((sum, item) => sum + item.population, 0);
  return { deltaPriority: populationMean(modified, (t) => t.currentState.priorityIndex ?? 0) - populationMean(valid, (t) => t.currentState.priorityIndex ?? 0),
    deltaAccessConcentration: (concentration(modified, measures.accessDeficit) ?? 0) - (concentration(valid, measures.accessDeficit) ?? 0),
    deltaPressureConcentration: (concentration(modified, measures.pressure) ?? 0) - (concentration(valid, measures.pressure) ?? 0),
    deltaHighPopulation: highPopulation(modified) - highPopulation(valid) };
}
const targeting: Record<string, unknown>[] = [];
for (const type of ['new_facility', 'expand_capacity', 'improve_access'] as const) {
  const candidates = rawResults.filter((item) => item.params.type === type);
  for (const propagate of [true, false]) {
    const rows = candidates.map((result) => ({ result, target: valid.find((t) => t.id === result.params.targetDistrictId)!, metrics: comparisonMetrics(valid.find((t) => t.id === result.params.targetDistrictId)!, result, propagate) }));
    const best = (fn: (row: typeof rows[number]) => number) => [...rows].sort((a, b) => fn(b) - fn(a))[0];
    const selected = [
      ['Máxima prioridad', best((r) => r.target.currentState.priorityIndex ?? -1)],
      ['Máxima presión', best((r) => r.target.currentState.systemPressure ?? -1)],
      ['Máxima demanda', best((r) => r.target.currentState.historicalDemand)],
      ['Máxima población', best((r) => r.target.population)],
      ['Óptimo ex post', [...rows].sort((a, b) => a.metrics.deltaPriority - b.metrics.deltaPriority)[0]],
    ] as const;
    for (const [rule, row] of selected) targeting.push({ intervention: type, propagation: propagate, rule, district: row.target.name, ...row.metrics });
    targeting.push({ intervention: type, propagation: propagate, rule: 'Aleatoria (esperanza exacta)', district: 'todos',
      deltaPriority: mean(rows.map((r) => r.metrics.deltaPriority)), deltaAccessConcentration: mean(rows.map((r) => r.metrics.deltaAccessConcentration)),
      deltaPressureConcentration: mean(rows.map((r) => r.metrics.deltaPressureConcentration)), deltaHighPopulation: mean(rows.map((r) => r.metrics.deltaHighPopulation)) });
  }
}

// RQ3: 10 000 pesos Dirichlet para cada concentración. Generador con semilla fija.
const sensitivity: Record<string, unknown>[] = [];
const baseRanking = [...valid].sort((a, b) => (b.currentState.priorityIndex ?? 0) - (a.currentState.priorityIndex ?? 0));
function gamma(shape: number, random: () => number): number {
  // Marsaglia-Tsang, shape >= 1 para las concentraciones utilizadas.
  const d = shape - 1 / 3, c = 1 / Math.sqrt(9 * d);
  while (true) {
    const normal = Math.sqrt(-2 * Math.log(Math.max(random(), 1e-12))) * Math.cos(2 * Math.PI * random());
    const v = (1 + c * normal) ** 3;
    if (v <= 0) continue;
    const u = random();
    if (u < 1 - .0331 * normal ** 4 || Math.log(u) < .5 * normal * normal + d * (1 - v + Math.log(v))) return d * v;
  }
}
const sensRng = rng(42);
for (const alpha of [20, 50, 100]) {
  let tauTotal = 0, changedCategories = 0, topUnchanged = 0;
  const baseWeights = [.35, .25, .25, .15];
  for (let iteration = 0; iteration < 10000; iteration++) {
    const weights = baseWeights.map((weight) => gamma(weight * alpha, sensRng));
    const total = weights.reduce((sum, item) => sum + item, 0);
    const w = weights.map((item) => item / total);
    const scores = new Map(valid.map((t) => {
      const components = [t.sdoh.povertyRate, Math.min(Math.max(t.currentState.systemPressure! - .6, 0), 1), 1 - t.currentState.accessibilityIndex!, t.currentState.contagionRisk * .8];
      const score = Math.round(Math.min(Math.max(components.reduce((sum, value, index) => sum + value * w[index], 0), .05), .98) * 100) / 100;
      return [t.id, score];
    }));
    const sorted = [...valid].sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0));
    if (sorted[0]?.id === baseRanking[0]?.id) topUnchanged++;
    for (const territory of valid) if (getHotspotCategory(scores.get(territory.id)!) !== territory.currentState.hotspotCategory) changedCategories++;
    let concordance = 0;
    for (let i = 0; i < baseRanking.length; i++) for (let j = i + 1; j < baseRanking.length; j++)
      concordance += sorted.findIndex((t) => t.id === baseRanking[i].id) < sorted.findIndex((t) => t.id === baseRanking[j].id) ? 1 : -1;
    tauTotal += concordance / (baseRanking.length * (baseRanking.length - 1) / 2);
  }
  sensitivity.push({ alpha, draws: 10000, meanKendallTau: tauTotal / 10000, topDistrictStableShare: topUnchanged / 10000,
    categoryChangeShare: changedCategories / (10000 * valid.length) });
}

const evaluatedTexts = valid.map((t) => {
  const base = construirDictamenBase(t, territories, view.facilities);
  const narrative = narrativaPorReglas(base, t);
  const demand = t.currentState.historicalDemand!.toLocaleString('es-PE');
  const priority = `${(t.currentState.priorityIndex! * 100).toFixed(1)} %`;
  const factsMatched = narrative.resumenEjecutivo.includes(demand) && narrative.resumenEjecutivo.includes(priority)
    && snapshot.sources.some((source) => source.id === 'sis' && source.pageUrl.length > 0)
    && snapshot.sources.some((source) => source.id === 'poverty' && source.pageUrl.length > 0);
  return { district: t.name, factsMatched, sourceIds: ['sis', 'poverty'], text: narrative.resumenEjecutivo };
});
const results = { version: snapshot.version, month: view.month, generatedAt: new Date().toISOString(), rq1, fixtureDefects, concentration: concentrationRows, targeting, sensitivity,
  textCheck: { outputsEvaluated: evaluatedTexts.length, method: 'Narrativas por reglas comparadas con los hechos SIS y prioridad que también se entregan al agente; fuentes SIS e INEI verificadas. No incluye respuestas libres del agente.', matches: evaluatedTexts.filter((item) => item.factsMatched).length },
  sourceReferences: snapshot.sources.map(({ id, pageUrl, resourceUrl, period, fetchedAt }) => ({ id, pageUrl, resourceUrl, period, fetchedAt })) };
await Promise.all([
  writeFile(`${output}/results.json`, JSON.stringify(results, null, 2)),
  writeFile(`${output}/rq1-scenarios.csv`, csv(scenarios)),
  writeFile(`${output}/rq1-prototype-fixture.csv`, csv(fixtureDefects)),
  writeFile(`${output}/rq2-concentration.csv`, csv(concentrationRows)),
  writeFile(`${output}/rq2-targeting.csv`, csv(targeting)),
  writeFile(`${output}/rq3-sensitivity.csv`, csv(sensitivity)),
  writeFile(`${output}/text-check.csv`, csv(evaluatedTexts)),
]);
const report = `# Evaluación reproducible GDUS Trujillo\n\nVersión: **${snapshot.version}**. Consultas SIS: **${view.month}**. Generado: ${results.generatedAt}.\n\n## Alcance y métodos\n\nDiez distritos; Simbal y Alto Trujillo excluidos. Las consultas externas SIS son sumas de ATENCIONES (código 56), no personas. Población INEI por año; pobreza INEI 2018 como punto medio del intervalo. Capacidad: percentil 95 de doce meses con al menos seis observaciones; accesibilidad: distancia geográfica × 1,3 a 20 km/h más cinco minutos. Los efectos de intervención y vecinos son supuestos fijos.\n\n## RQ1\n\nLíneas base comprobadas: ${rq1.baselineCases}; discrepancias: ${rq1.baselineMismatch}. Escenarios: ${rq1.scenarios}; discrepancias numéricas: ${rq1.scenarioMismatch}; violaciones metamórficas: ${rq1.metamorphicViolations}. Paridad Python: ${rq1.pythonCases} casos, ${rq1.pythonMismatch} discrepancias${rq1.pythonError ? `; error: ${rq1.pythonError}` : ''}. La prueba compara prioridad antes y después y dirección de efectos.\n\n## RQ2\n\nÍndice de concentración ponderado por población, ordenado por pobreza ascendente. IC positivo significa concentración en la población con mayor pobreza. Bootstrap de distritos de 5 000 réplicas, semilla 1; intervalos orientativos con solo diez unidades. Las cinco reglas del artículo son prioridad, presión, demanda, población y asignación aleatoria, más óptimo ex post. Se repite con y sin efectos fijos sobre vecinos. Ver CSV para cifras y distritos seleccionados.\n\n${concentrationRows.map((r) => `- ${r.indicator}: IC ${r.concentration?.toFixed(3)} [${r.ciLow.toFixed(3)}, ${r.ciHigh.toFixed(3)}]; Q5/Q1 ${r.q5OverQ1?.toFixed(2) ?? 'sin dato'}.`).join('\n')}\n\n## RQ3\n\n10 000 pesos Dirichlet por concentración 20, 50 y 100; semilla 42. Se calcula concordancia de ranking y frecuencia de cambios de categoría usando la misma fórmula de prioridad.\n\n${sensitivity.map((r) => `- α=${r.alpha}: τ medio ${Number(r.meanKendallTau).toFixed(3)}, primero estable ${Number(r.topDistrictStableShare).toFixed(3)}, cambios de categoría ${Number(r.categoryChangeShare).toFixed(3)}.`).join('\n')}\n\n## Trazabilidad de textos\n\n${results.textCheck.outputsEvaluated} salidas de plantilla determinista examinadas contra sus hechos. No se han evaluado respuestas libres del agente; no se infiere una tasa general de fidelidad.\n\n## Correspondencia con el artículo\n\n| Elemento | Estado actual | Cambio en el Word |\n|---|---|---|\n| Población, RENIPRESS, SIS, límites | Fuentes oficiales procesadas | Sustituir descripción de datos sintéticos y publicar fechas/versiones |\n| Pobreza | Intervalo INEI 2018; punto medio derivado | Declarar desfase temporal y aproximación |\n| Otros determinantes SDOH | Sin dato | Eliminar afirmaciones y tablas basadas en variables inventadas |\n| Capacidad, acceso, prioridad | Estimaciones explícitas | Reescribir método y limitaciones |\n| Pronóstico | Persistencia estacional, evaluación temporal | Retirar ST-GNN y métricas precargadas |\n| RQ1–RQ3 | Resultados nuevos en CSV/JSON | Recalcular todas las tablas, figuras, resumen y conclusiones |\n| Intervenciones | Efectos hipotéticos fijos | Declarar que no son efectos causales observados |\n\n## Fuentes\n\n${snapshot.sources.map((s) => `- ${s.name} (${s.period}; consultado ${s.fetchedAt}): [página](${s.pageUrl}), [recurso](${s.resourceUrl}).`).join('\n')}\n`;
const fullReport = report.replace('## RQ2', `El fixture sintético original se estudia por separado en \`rq1-prototype-fixture.csv\`: ${fixtureDefects.filter((item) => item.discrepancy !== 0).length} de diez líneas base difieren de la fórmula actual. Estas cifras no se usan en la app.\n\n## RQ2`)
  + `\n### Recursos SIS descargados\n\n${(snapshot.sources.find((source) => source.id === 'sis')?.resourceUrls ?? []).map((url) => `- [ZIP SIS](${url})`).join('\n')}\n`;
await writeFile(`${output}/report.md`, fullReport);
console.log(`Evaluación: ${output}/report.md`);
