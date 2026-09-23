/** Formateadores compartidos, todos anclados a la configuración regional es-PE. */

const LOCALE = 'es-PE';

export const formatNumber = (value: number | null | undefined, maximumFractionDigits = 0) =>
  value === null || value === undefined || !Number.isFinite(value) ? 'Sin dato' : new Intl.NumberFormat(LOCALE, { maximumFractionDigits }).format(value);

/** 0.62 -> "62%" */
export const formatPercent = (ratio: number | null | undefined, digits = 0) =>
  ratio === null || ratio === undefined || !Number.isFinite(ratio) ? 'Sin dato' : `${(ratio * 100).toFixed(digits)}%`;

/** 0.62 -> "62" (sin símbolo, para tipografía grande) */
export const formatScore = (ratio: number | null | undefined, digits = 0) =>
  ratio === null || ratio === undefined || !Number.isFinite(ratio) ? 'Sin dato' : (ratio * 100).toFixed(digits);

/** Prefija siempre el signo: +4.2 / -1.8 */
export const formatSigned = (value: number, digits = 1, suffix = '') =>
  `${value > 0 ? '+' : ''}${value.toFixed(digits)}${suffix}`;

export const formatMinutes = (value: number | null | undefined) =>
  value === null || value === undefined || !Number.isFinite(value) ? 'Sin dato' : `${Number.isInteger(value) ? value : value.toFixed(1)} min`;

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(LOCALE, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(LOCALE, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/** Etiquetas legibles para los tipos de intervención del simulador. */
export const INTERVENTION_LABELS: Record<string, string> = {
  new_facility: 'Nueva IPRESS',
  expand_capacity: 'Ampliación de capacidad',
  improve_access: 'Mejora de accesibilidad',
  temporary_closure: 'Cierre / contingencia',
};

export const interventionLabel = (type: string) =>
  INTERVENTION_LABELS[type] ?? type;
