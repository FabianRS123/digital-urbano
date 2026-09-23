import type { DictamenNarrativa, DictamenTecnico, HealthFacility, IndicadorDictamen, Territory } from '../types';
import { getRiskFactorsExplanation } from './spatiotemporalGnn';

const pct = (value: number | null) => value === null ? 'Sin dato' : `${(value * 100).toFixed(1)} %`;
const number = (value: number | null) => value === null ? 'Sin dato' : value.toLocaleString('es-PE');

export function construirDictamenBase(territory: Territory, territories: Territory[], facilities: HealthFacility[]): Omit<DictamenTecnico, 'narrativa' | 'fuente'> {
  const state = territory.currentState;
  const indicators: IndicadorDictamen[] = [
    { grupo: 'Demanda SIS', indicador: 'Consultas externas registradas', valor: number(state.historicalDemand), referencia: state.monthKey, estado: 'adecuado' },
    { grupo: 'Demanda SIS', indicador: 'Proyección estacional siguiente mes', valor: number(state.projectedDemand), referencia: 'Persistencia del mismo mes del año anterior', estado: 'adecuado' },
    { grupo: 'Capacidad estimada', indicador: 'Referencia mensual de IPRESS con actividad SIS', valor: number(state.healthcareCapacity), referencia: 'P95 de últimos doce meses; mínimo seis', estado: state.systemPressure !== null && state.systemPressure > 1 ? 'alerta' : 'adecuado' },
    { grupo: 'Capacidad estimada', indicador: 'Presión SIS / referencia', valor: pct(state.systemPressure), referencia: 'Cociente, no ocupación clínica', estado: state.systemPressure !== null && state.systemPressure > 1 ? 'alerta' : 'adecuado' },
    { grupo: 'Accesibilidad estimada', indicador: 'Tiempo geográfico de traslado', valor: state.avgTravelTimeMinutes === null ? 'Sin dato' : `${state.avgTravelTimeMinutes.toFixed(1)} min`, referencia: 'Distancia × 1,3 / 20 km/h + 5 min', estado: 'adecuado' },
    { grupo: 'Accesibilidad estimada', indicador: 'A = exp(−tiempo/30)', valor: pct(state.accessibilityIndex), referencia: 'Aproximación geográfica', estado: 'adecuado' },
    { grupo: 'Pobreza INEI 2018', indicador: 'Punto medio del intervalo publicado', valor: pct(territory.sdoh.povertyRate), referencia: territory.povertyInterval ? `Intervalo ${territory.povertyInterval[0]}–${territory.povertyInterval[1]} %` : 'Sin intervalo', estado: 'adecuado' },
    { grupo: 'Prioridad derivada', indicador: 'Índice de prioridad', valor: pct(state.priorityIndex), referencia: 'Modelo de cuatro componentes', estado: state.priorityIndex !== null && state.priorityIndex >= .8 ? 'critico' : 'adecuado' },
  ];
  const sorted = [...territories].sort((a, b) => (b.currentState.priorityIndex ?? -1) - (a.currentState.priorityIndex ?? -1));
  return {
    codigo: `DT-TRU-${territory.code}-${state.monthKey}`,
    fechaEmision: new Date().toISOString(), periodo: state.monthKey,
    distrito: { id: territory.id, nombre: territory.name, ubigeo: territory.code, provincia: territory.province, departamento: territory.department, poblacion: territory.population, areaKm2: territory.areaKm2 },
    clasificacion: { prioridad: state.priorityIndex, categoria: state.hotspotCategory, quintil: territory.sdoh.vulnerabilityQuintile, rankingMetropolitano: sorted.findIndex((item) => item.id === territory.id) + 1, totalDistritos: territories.length },
    indicadores: indicators,
    factoresRiesgo: getRiskFactorsExplanation(territory).map((item) => ({ factor: item.factor, categoria: item.category, peso: item.weight, puntuacion: item.score, impacto: item.impact })),
    ipress: facilities.filter((item) => item.districtId === territory.id && item.activitySis).map((item) => ({ nombre: item.name, categoria: item.category, estado: item.operationalStatus, horario: item.schedule, capacidad: item.monthlyCapacity, demanda: item.currentMonthlyDemand, carga: item.pressureRatio })),
    vecinos: territory.neighborIds.map((id) => territories.find((item) => item.id === id)).filter((item): item is Territory => Boolean(item)).map((item) => ({ nombre: item.name, prioridad: item.currentState.priorityIndex, categoria: item.currentState.hotspotCategory, presion: item.currentState.systemPressure })),
    notaEtica: 'Consultas externas observadas de asegurados SIS. Capacidad, accesibilidad, prioridad e intervenciones son estimaciones y supuestos del modelo, no medidas clínicas. Pobreza corresponde a INEI 2018.',
  };
}

export function narrativaPorReglas(base: Omit<DictamenTecnico, 'narrativa' | 'fuente'>, territory: Territory): DictamenNarrativa {
  const state = territory.currentState;
  return {
    resumenEjecutivo: `${territory.name} registró ${number(state.historicalDemand)} consultas externas SIS en ${state.monthKey}. Su prioridad derivada es ${pct(state.priorityIndex)}. La población publicada para ${state.monthKey.slice(0, 4)} es ${number(territory.population)} habitantes.`,
    hallazgos: [{ titulo: 'Lectura de la demanda', detalle: `La referencia de capacidad es ${number(state.healthcareCapacity)} consultas por mes, estimada desde el historial SIS de las IPRESS con actividad. La presión calculada es ${pct(state.systemPressure)}.`, severidad: state.systemPressure !== null && state.systemPressure > 1 ? 'media' : 'baja' }],
    recomendaciones: [{ prioridad: 1, accion: 'Revisar capacidad y demanda con la red asistencial', tipo: 'Validación', justificacion: 'La referencia SIS mide actividad histórica, no capacidad física instalada.', plazo: 'Antes de decidir inversiones' }],
    efectoRed: `El componente espacial usa la presión de ${territory.neighborIds.length} distritos colindantes. Los efectos de intervenciones sobre vecinos son hipótesis fijas del simulador.`,
    limitaciones: ['Las consultas SIS no son pacientes únicos ni toda la demanda sanitaria.', 'Capacidad y viaje son aproximaciones; no sustituyen datos de infraestructura o rutas viales.', 'Pobreza de 2018 y población del periodo tienen fechas distintas.', 'No existe una ST-GNN entrenada para estos resultados.'],
  };
}
