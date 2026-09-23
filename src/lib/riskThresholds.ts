export const RISK_THRESHOLDS = {
  BAJO: { min: 0, max: 0.39, label: 'Bajo' },
  MEDIO: { min: 0.4, max: 0.59, label: 'Medio' },
  ALTO: { min: 0.6, max: 0.79, label: 'Alto' },
  CRITICO: { min: 0.8, max: 1, label: 'Crítico' },
};

export function getHotspotCategory(score: number): 'Bajo' | 'Medio' | 'Alto' | 'Crítico' {
  if (score >= RISK_THRESHOLDS.CRITICO.min) return 'Crítico';
  if (score >= RISK_THRESHOLDS.ALTO.min) return 'Alto';
  if (score >= RISK_THRESHOLDS.MEDIO.min) return 'Medio';
  return 'Bajo';
}
