import {
  DictamenNarrativa,
  DictamenTecnico,
  EstadoIndicador,
  HallazgoDictamen,
  HealthFacility,
  IndicadorDictamen,
  RecomendacionDictamen,
  Territory,
} from '../types';
import { getRiskFactorsExplanation } from './spatiotemporalGnn';

/**
 * Construcción del dictamen técnico.
 *
 * Todo lo numérico (indicadores, factores, IPRESS, vecinos) se arma aquí con
 * los datos del motor. La IA solo aporta la `narrativa`; si no está disponible,
 * `narrativaPorReglas` produce una equivalente de forma determinista.
 */

const pct = (v: number, d = 0) => `${(v * 100).toFixed(d)} %`;
const num = (v: number) => v.toLocaleString('es-PE');
const promedio = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(xs.length, 1);

/** Mayor es peor: crítico si supera la referencia en un 30 %, alerta si la supera. */
function estadoDeficit(valor: number, referencia: number): EstadoIndicador {
  if (valor > referencia * 1.3) return 'critico';
  if (valor > referencia) return 'alerta';
  return 'adecuado';
}

function referenciasMetropolitanas(territories: Territory[]) {
  return {
    pobreza: promedio(territories.map((t) => t.sdoh.povertyRate)),
    agua: promedio(territories.map((t) => t.sdoh.waterAccessDeficit)),
    saneamiento: promedio(territories.map((t) => t.sdoh.sanitationDeficit)),
    hacinamiento: promedio(territories.map((t) => t.sdoh.overcrowdingRate)),
    vivienda: promedio(territories.map((t) => t.sdoh.precariousHousingPct)),
    accesibilidad: promedio(territories.map((t) => t.currentState.accessibilityIndex)),
    tiempoViaje: promedio(territories.map((t) => t.currentState.avgTravelTimeMinutes)),
    presion: promedio(territories.map((t) => t.currentState.systemPressure)),
  };
}

function construirIndicadores(t: Territory, territories: Territory[]): IndicadorDictamen[] {
  const ref = referenciasMetropolitanas(territories);
  const s = t.sdoh;
  const c = t.currentState;

  return [
    {
      grupo: 'Demanda y oferta',
      indicador: 'Demanda mensual registrada',
      valor: `${num(c.historicalDemand)} atenciones`,
      referencia: `Capacidad ${num(c.healthcareCapacity)}`,
      estado: c.historicalDemand > c.healthcareCapacity ? 'critico' : 'adecuado',
    },
    {
      grupo: 'Demanda y oferta',
      indicador: 'Demanda proyectada (t+1)',
      valor: `${num(c.projectedDemand)} atenciones`,
      referencia: `Actual ${num(c.historicalDemand)}`,
      estado: c.projectedDemand > c.healthcareCapacity ? 'alerta' : 'adecuado',
    },
    {
      grupo: 'Demanda y oferta',
      indicador: 'Presión asistencial',
      valor: pct(c.systemPressure),
      referencia: `Umbral 100 % · Metro ${pct(ref.presion)}`,
      estado: c.systemPressure > 1.2 ? 'critico' : c.systemPressure > 1 ? 'alerta' : 'adecuado',
    },
    {
      grupo: 'Demanda y oferta',
      indicador: 'IPRESS activas',
      valor: `${t.activeFacilitiesCount}`,
      referencia: `${num(Math.round(t.population / Math.max(t.activeFacilitiesCount, 1)))} hab por IPRESS`,
      estado: 'adecuado',
    },
    {
      grupo: 'Accesibilidad',
      indicador: 'Índice de accesibilidad',
      valor: pct(c.accessibilityIndex),
      referencia: `Metro ${pct(ref.accesibilidad)}`,
      estado: c.accessibilityIndex < 0.4 ? 'critico' : c.accessibilityIndex < ref.accesibilidad ? 'alerta' : 'adecuado',
    },
    {
      grupo: 'Accesibilidad',
      indicador: 'Tiempo medio de viaje',
      valor: `${c.avgTravelTimeMinutes} min`,
      referencia: `Metro ${ref.tiempoViaje.toFixed(1)} min`,
      estado: estadoDeficit(c.avgTravelTimeMinutes, ref.tiempoViaje),
    },
    {
      grupo: 'Accesibilidad',
      indicador: 'Distancia media a IPRESS',
      valor: `${c.avgDistanceKm} km`,
      referencia: '—',
      estado: 'adecuado',
    },
    {
      grupo: 'Determinantes sociales',
      indicador: 'Vulnerabilidad SDOH',
      valor: `${pct(s.vulnerabilityIndex)} (Q${s.vulnerabilityQuintile})`,
      referencia: 'Q1 menor · Q5 mayor',
      estado: s.vulnerabilityIndex > 0.7 ? 'critico' : s.vulnerabilityIndex > 0.45 ? 'alerta' : 'adecuado',
    },
    {
      grupo: 'Determinantes sociales',
      indicador: 'Pobreza monetaria',
      valor: pct(s.povertyRate),
      referencia: `Metro ${pct(ref.pobreza)}`,
      estado: estadoDeficit(s.povertyRate, ref.pobreza),
    },
    {
      grupo: 'Determinantes sociales',
      indicador: 'Déficit de agua potable',
      valor: pct(s.waterAccessDeficit),
      referencia: `Metro ${pct(ref.agua)}`,
      estado: estadoDeficit(s.waterAccessDeficit, ref.agua),
    },
    {
      grupo: 'Determinantes sociales',
      indicador: 'Déficit de saneamiento',
      valor: pct(s.sanitationDeficit),
      referencia: `Metro ${pct(ref.saneamiento)}`,
      estado: estadoDeficit(s.sanitationDeficit, ref.saneamiento),
    },
    {
      grupo: 'Determinantes sociales',
      indicador: 'Hacinamiento crítico',
      valor: pct(s.overcrowdingRate),
      referencia: `Metro ${pct(ref.hacinamiento)}`,
      estado: estadoDeficit(s.overcrowdingRate, ref.hacinamiento),
    },
    {
      grupo: 'Determinantes sociales',
      indicador: 'Vivienda precaria',
      valor: pct(s.precariousHousingPct),
      referencia: `Metro ${pct(ref.vivienda)}`,
      estado: estadoDeficit(s.precariousHousingPct, ref.vivienda),
    },
    {
      grupo: 'Riesgo territorial',
      indicador: 'Índice de prioridad sanitaria',
      valor: `${pct(c.priorityIndex)} · ${c.hotspotCategory}`,
      referencia: 'Crítico desde 80 %',
      estado: c.priorityIndex >= 0.8 ? 'critico' : c.priorityIndex >= 0.6 ? 'alerta' : 'adecuado',
    },
    {
      grupo: 'Riesgo territorial',
      indicador: 'Riesgo de difusión espacial',
      valor: pct(c.contagionRisk),
      referencia: `${t.neighborIds.length} distritos colindantes`,
      estado: c.contagionRisk > 0.7 ? 'critico' : c.contagionRisk > 0.5 ? 'alerta' : 'adecuado',
    },
  ];
}

/** Estructura completa salvo la narrativa. */
export function construirDictamenBase(
  territory: Territory,
  territories: Territory[],
  facilities: HealthFacility[],
): Omit<DictamenTecnico, 'narrativa' | 'fuente'> {
  const ranking = [...territories].sort(
    (a, b) => b.currentState.priorityIndex - a.currentState.priorityIndex,
  );
  const hoy = new Date();
  const fecha = hoy.toISOString().slice(0, 10);

  return {
    codigo: `DT-TRU-${territory.code}-${fecha.replace(/-/g, '')}`,
    fechaEmision: hoy.toISOString(),
    periodo: territory.currentState.monthKey,
    distrito: {
      id: territory.id,
      nombre: territory.name,
      ubigeo: territory.code,
      provincia: territory.province,
      departamento: territory.department,
      poblacion: territory.population,
      areaKm2: territory.areaKm2,
    },
    clasificacion: {
      prioridad: territory.currentState.priorityIndex,
      categoria: territory.currentState.hotspotCategory,
      quintil: territory.sdoh.vulnerabilityQuintile,
      rankingMetropolitano: ranking.findIndex((t) => t.id === territory.id) + 1,
      totalDistritos: territories.length,
    },
    indicadores: construirIndicadores(territory, territories),
    factoresRiesgo: getRiskFactorsExplanation(territory).map((f) => ({
      factor: f.factor,
      categoria: f.category,
      peso: f.weight,
      puntuacion: f.score,
      impacto: f.impact,
    })),
    ipress: facilities
      .filter((f) => f.districtId === territory.id)
      .map((f) => ({
        nombre: f.name,
        categoria: f.category,
        estado: f.operationalStatus,
        horario: f.schedule,
        capacidad: f.monthlyCapacity,
        demanda: f.currentMonthlyDemand,
        carga: f.pressureRatio,
      })),
    vecinos: territory.neighborIds
      .map((id) => territories.find((t) => t.id === id))
      .filter((t): t is Territory => Boolean(t))
      .map((t) => ({
        nombre: t.name,
        prioridad: t.currentState.priorityIndex,
        categoria: t.currentState.hotspotCategory,
        presion: t.currentState.systemPressure,
      })),
    notaEtica:
      'Las estimaciones provienen de un modelo espacio-temporal aplicado a datos agregados y sintéticos del Área Metropolitana de Trujillo. Describen asociaciones, no relaciones causales, y constituyen un insumo de apoyo a la decisión que no sustituye la evaluación técnica de las autoridades sanitarias competentes.',
  };
}

/** Narrativa determinista, usada cuando la capa agéntica no está disponible. */
export function narrativaPorReglas(
  base: Omit<DictamenTecnico, 'narrativa' | 'fuente'>,
  territory: Territory,
): DictamenNarrativa {
  const c = territory.currentState;
  const s = territory.sdoh;
  const deficitAtenciones = c.historicalDemand - c.healthcareCapacity;
  const sobrecargadas = base.ipress.filter((f) => f.carga > 1);
  const criticos = base.indicadores.filter((i) => i.estado === 'critico');

  const hallazgos: HallazgoDictamen[] = [];

  if (c.systemPressure > 1) {
    hallazgos.push({
      titulo: 'Demanda asistencial por encima de la capacidad instalada',
      detalle: `La presión asistencial alcanza ${pct(c.systemPressure)}: se registran ${num(c.historicalDemand)} atenciones mensuales frente a una capacidad de ${num(c.healthcareCapacity)}, un déficit de ${num(deficitAtenciones)} atenciones. La proyección para el siguiente periodo es de ${num(c.projectedDemand)} atenciones.`,
      severidad: c.systemPressure > 1.2 ? 'alta' : 'media',
    });
  }

  if (sobrecargadas.length > 0) {
    hallazgos.push({
      titulo: `${sobrecargadas.length} de ${base.ipress.length} IPRESS operan sobre su capacidad`,
      detalle: sobrecargadas
        .map((f) => `${f.nombre} (Cat. ${f.categoria}) al ${pct(f.carga)}`)
        .join('; ') + '.',
      severidad: sobrecargadas.length >= base.ipress.length / 2 ? 'alta' : 'media',
    });
  }

  if (c.accessibilityIndex < 0.5 || c.avgTravelTimeMinutes > 30) {
    hallazgos.push({
      titulo: 'Barrera geográfica de acceso al primer nivel',
      detalle: `El índice de accesibilidad es de ${pct(c.accessibilityIndex)}, con un tiempo medio de viaje de ${c.avgTravelTimeMinutes} min y una distancia media de ${c.avgDistanceKm} km hasta el establecimiento.`,
      severidad: c.accessibilityIndex < 0.4 ? 'alta' : 'media',
    });
  }

  if (s.vulnerabilityIndex > 0.45) {
    hallazgos.push({
      titulo: 'Determinantes sociales desfavorables',
      detalle: `Vulnerabilidad SDOH de ${pct(s.vulnerabilityIndex)} (quintil ${s.vulnerabilityQuintile}), con ${pct(s.povertyRate)} de pobreza, ${pct(s.waterAccessDeficit)} de déficit de agua potable y ${pct(s.sanitationDeficit)} de déficit de saneamiento.`,
      severidad: s.vulnerabilityIndex > 0.7 ? 'alta' : 'media',
    });
  }

  if (c.contagionRisk > 0.5) {
    hallazgos.push({
      titulo: 'Exposición a desbordamiento de demanda entre distritos',
      detalle: `El riesgo de difusión espacial es de ${pct(c.contagionRisk)} sobre ${territory.neighborIds.length} distritos colindantes, lo que propaga la presión asistencial por la red metropolitana.`,
      severidad: c.contagionRisk > 0.7 ? 'alta' : 'media',
    });
  }

  if (hallazgos.length === 0) {
    hallazgos.push({
      titulo: 'Situación estable',
      detalle: `El distrito no presenta indicadores en nivel crítico. Su índice de prioridad es de ${pct(c.priorityIndex)} (${c.hotspotCategory}).`,
      severidad: 'baja',
    });
  }

  const recomendaciones: RecomendacionDictamen[] = [];

  if (c.systemPressure > 1.2) {
    recomendaciones.push({
      prioridad: 0,
      accion: 'Implementar una nueva IPRESS de primer nivel (categoría I-3 o I-4)',
      tipo: 'Infraestructura',
      justificacion: `El déficit de ${num(deficitAtenciones)} atenciones mensuales supera lo que puede absorber una ampliación de horario en los establecimientos existentes.`,
      plazo: 'Mediano plazo (6–18 meses)',
    });
  }
  if (c.systemPressure > 1 || sobrecargadas.length > 0) {
    recomendaciones.push({
      prioridad: 0,
      accion: 'Ampliar horario y consultorios en las IPRESS sobrecargadas',
      tipo: 'Capacidad operativa',
      justificacion: sobrecargadas.length
        ? `Descongestiona de forma inmediata ${sobrecargadas.map((f) => f.nombre).join(', ')}.`
        : `Reduce la presión asistencial de ${pct(c.systemPressure)} mientras se ejecutan medidas estructurales.`,
      plazo: 'Corto plazo (0–6 meses)',
    });
  }
  if (c.accessibilityIndex < 0.5 || c.avgTravelTimeMinutes > 30) {
    recomendaciones.push({
      prioridad: 0,
      accion: 'Habilitar transporte sociosanitario y mejorar la conectividad vial hacia la IPRESS de referencia',
      tipo: 'Accesibilidad',
      justificacion: `Busca reducir el tiempo medio de viaje de ${c.avgTravelTimeMinutes} min a menos de 20 min.`,
      plazo: 'Mediano plazo (6–18 meses)',
    });
  }
  if (s.vulnerabilityIndex > 0.45) {
    recomendaciones.push({
      prioridad: 0,
      accion: 'Coordinar con la municipalidad y la EPS una intervención en agua y saneamiento',
      tipo: 'Intersectorial',
      justificacion: `Ataca los determinantes que elevan la demanda prevenible: ${pct(s.sanitationDeficit)} de déficit de saneamiento y ${pct(s.waterAccessDeficit)} de déficit de agua.`,
      plazo: 'Largo plazo (más de 18 meses)',
    });
  }
  recomendaciones.push({
    prioridad: 0,
    accion: 'Monitorear mensualmente la presión asistencial y el índice de prioridad en el gemelo digital',
    tipo: 'Vigilancia',
    justificacion: 'Permite verificar el efecto de las intervenciones y recalibrar el orden de prioridad.',
    plazo: 'Continuo',
  });
  recomendaciones.forEach((r, i) => (r.prioridad = i + 1));

  const vecinosTexto = base.vecinos.length
    ? base.vecinos
        .map((v) => `${v.nombre} (prioridad ${pct(v.prioridad)}, presión ${pct(v.presion)})`)
        .join('; ')
    : 'sin distritos colindantes registrados';

  return {
    resumenEjecutivo: `El distrito de ${territory.name} (${num(territory.population)} habitantes) ocupa el puesto ${base.clasificacion.rankingMetropolitano} de ${base.clasificacion.totalDistritos} en prioridad sanitaria metropolitana, con un índice de ${pct(c.priorityIndex)} (${c.hotspotCategory}). ${criticos.length} de ${base.indicadores.length} indicadores se encuentran en nivel crítico, concentrados en ${[...new Set(criticos.map((i) => i.grupo.toLowerCase()))].join(', ') || 'ningún grupo'}.`,
    hallazgos,
    recomendaciones,
    efectoRed: `Una intervención que reduzca la presión asistencial en ${territory.name} alivia la derivación de pacientes hacia sus distritos colindantes: ${vecinosTexto}. Por el contrario, cualquier cierre o contingencia local trasladaría demanda hacia ellos.`,
    limitaciones: [
      'Los datos del gemelo son sintéticos y calibrados para validar la arquitectura; no provienen aún de INEI, SIS o RENIPRESS en tiempo real.',
      'Las métricas están agregadas a nivel distrital y no reflejan la heterogeneidad interna de los sectores.',
      'La importancia de los factores describe asociaciones estadísticas, no relaciones causales.',
      'Las proyecciones pierden precisión con el horizonte: la banda de incertidumbre se amplía cada mes.',
    ],
  };
}
