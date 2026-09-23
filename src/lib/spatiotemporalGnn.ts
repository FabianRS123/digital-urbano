import type { Territory, RiskFactorExplication } from '../types';
import { nextMonth, percentile, seasonalForecast } from './officialModel';

export interface SpatioTemporalPredictionPoint {
  monthKey: string; label: string; historicalValue: number | null;
  predictedValue: number; lowerConfidence: number; upperConfidence: number;
  lower95?: number; upper95?: number; isForecast: boolean;
}

/** Persistencia estacional evaluable; el historial procede de consultas externas SIS. */
export function generateDistrictTimeSeries(district: Territory, monthsHorizon = 6): SpatioTemporalPredictionPoint[] {
  const history = district.history ?? {};
  const months = Object.keys(history).filter((month) => month <= district.currentState.monthKey).sort();
  if (!months.length) return [];
  const errors: number[] = [];
  for (let i = 12; i < months.length; i++) {
    const prediction = seasonalForecast(Object.fromEntries(months.slice(0, i).map((m) => [m, history[m]])), months[i]);
    if (prediction !== null) errors.push(Math.abs(prediction - history[months[i]]));
  }
  const band90 = percentile(errors, 0.9) ?? 0;
  const band95 = percentile(errors, 0.95) ?? band90;
  const label = (month: string) => new Intl.DateTimeFormat('es-PE', { month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${month}-01T00:00:00Z`));
  const actual = months.slice(-12).map((month) => ({ monthKey: month, label: label(month),
    historicalValue: history[month], predictedValue: history[month],
    lowerConfidence: history[month], upperConfidence: history[month], isForecast: false }));
  const forecast = Array.from({ length: monthsHorizon }, (_, i) => {
    const month = nextMonth(months.at(-1)!, i + 1);
    const value = seasonalForecast(history, month) ?? history[months.at(-1)!];
    return { monthKey: month, label: label(month), historicalValue: null, predictedValue: value,
      lowerConfidence: Math.max(0, Math.round(value - band90)), upperConfidence: Math.round(value + band90),
      lower95: Math.max(0, Math.round(value - band95)), upper95: Math.round(value + band95), isForecast: true };
  });
  return [...actual, ...forecast];
}

export function getRiskFactorsExplanation(district: Territory): RiskFactorExplication[] {
  const state = district.currentState;
  const pressureScore = state.systemPressure === null ? null : Math.min(Math.max(state.systemPressure - 0.6, 0), 1);
  return [
    { factor: 'Pobreza monetaria como aproximación social', category: 'SDOH', weight: 0.35,
      score: district.sdoh.vulnerabilityIndex, impact: 'Componente estimado',
      description: `Punto medio del intervalo de pobreza INEI 2018: ${(district.sdoh.povertyRate * 100).toFixed(1)} %. No equivale a un índice social multidimensional.` },
    { factor: 'Presión de consultas externas SIS', category: 'Infraestructura', weight: 0.25,
      score: pressureScore, impact: 'Componente estimado',
      description: state.systemPressure === null ? 'Capacidad de referencia no disponible.' :
        `Relación entre consultas SIS observadas y capacidad estimada: ${(state.systemPressure * 100).toFixed(1)} %.` },
    { factor: 'Accesibilidad geográfica aproximada', category: 'Accesibilidad', weight: 0.25,
      score: state.accessibilityIndex === null ? null : 1 - state.accessibilityIndex, impact: 'Componente estimado',
      description: state.avgTravelTimeMinutes === null ? 'Sin IPRESS pública de primer nivel localizable.' : `Tiempo referencial desde el punto distrital: ${state.avgTravelTimeMinutes.toFixed(1)} min. No es un tiempo de viaje observado.` },
    { factor: 'Presión de distritos vecinos', category: 'Espacial', weight: 0.15,
      score: state.contagionRisk * 0.8, impact: 'Regla del modelo',
      description: `Se usan ${district.neighborIds.length} distritos vecinos del mapa oficial. El efecto de red de las intervenciones es un supuesto.` },
  ];
}
