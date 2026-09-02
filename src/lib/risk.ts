/**
 * Fuente única de verdad para la escala de riesgo.
 * Los colores se leen de las variables CSS del tema, de modo que el mapa,
 * los gráficos y las insignias siempre coinciden entre modo claro y oscuro.
 */

export type RiskLevel = 'Bajo' | 'Medio' | 'Alto' | 'Crítico';

export interface RiskDefinition {
  level: RiskLevel;
  /** Umbral inferior inclusivo del índice de prioridad (0 – 1). */
  min: number;
  cssVar: string;
  /** Clases utilitarias para insignias. */
  badgeClass: string;
  /** Clase de color de texto. */
  textClass: string;
  /** Clase de fondo sólido (barras, chips de leyenda). */
  fillClass: string;
}

export const RISK_SCALE: RiskDefinition[] = [
  {
    level: 'Crítico',
    min: 0.8,
    cssVar: '--risk-critical',
    badgeClass:
      'bg-risk-critical/12 text-risk-critical border-risk-critical/30',
    textClass: 'text-risk-critical',
    fillClass: 'bg-risk-critical',
  },
  {
    level: 'Alto',
    min: 0.6,
    cssVar: '--risk-high',
    badgeClass: 'bg-risk-high/12 text-risk-high border-risk-high/30',
    textClass: 'text-risk-high',
    fillClass: 'bg-risk-high',
  },
  {
    level: 'Medio',
    min: 0.4,
    cssVar: '--risk-medium',
    badgeClass: 'bg-risk-medium/12 text-risk-medium border-risk-medium/30',
    textClass: 'text-risk-medium',
    fillClass: 'bg-risk-medium',
  },
  {
    level: 'Bajo',
    min: 0,
    cssVar: '--risk-low',
    badgeClass: 'bg-risk-low/12 text-risk-low border-risk-low/30',
    textClass: 'text-risk-low',
    fillClass: 'bg-risk-low',
  },
];

export function getRiskDefinition(score: number): RiskDefinition {
  return RISK_SCALE.find((r) => score >= r.min) ?? RISK_SCALE[RISK_SCALE.length - 1];
}

export const getRiskLevel = (score: number): RiskLevel =>
  getRiskDefinition(score).level;

export const getRiskBadgeClass = (score: number) =>
  getRiskDefinition(score).badgeClass;

export const getRiskTextClass = (score: number) =>
  getRiskDefinition(score).textClass;

export const getRiskFillClass = (score: number) =>
  getRiskDefinition(score).fillClass;

/**
 * Resuelve el color real (hex/rgb) desde el DOM. Necesario para MapLibre y
 * Recharts, que no aceptan clases de Tailwind.
 */
export function readCssColor(variable: string, fallback = '#517664'): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(variable)
    .trim();
  return value || fallback;
}

/** Semántica de "mejor / peor" para deltas: menos prioridad y presión es mejor. */
export function deltaTone(delta: number, lowerIsBetter = true) {
  if (Math.abs(delta) < 1e-9) return 'neutral' as const;
  const good = lowerIsBetter ? delta < 0 : delta > 0;
  return good ? ('positive' as const) : ('negative' as const);
}
