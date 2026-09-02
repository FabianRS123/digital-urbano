import { Territory, RiskFactorExplication } from '../types';

export interface SpatioTemporalPredictionPoint {
  monthKey: string;
  label: string;
  historicalValue: number | null;
  predictedValue: number;
  lowerConfidence: number;
  upperConfidence: number;
  isForecast: boolean;
}

export function generateDistrictTimeSeries(
  district: Territory,
  monthsHorizon: number = 6
): SpatioTemporalPredictionPoint[] {
  // Base demand scaled to district population and SDOH multiplier
  const baseDemand = district.currentState.historicalDemand;
  const growthRate = 0.003; // monthly baseline growth
  const results: SpatioTemporalPredictionPoint[] = [];

  // Generate 12 historical months (Set 2025 - Ago 2026)
  const histDates = [
    { year: 2025, month: 8, label: 'Set 2025' },
    { year: 2025, month: 9, label: 'Oct 2025' },
    { year: 2025, month: 10, label: 'Nov 2025' },
    { year: 2025, month: 11, label: 'Dic 2025' },
    { year: 2026, month: 0, label: 'Ene 2026' },
    { year: 2026, month: 1, label: 'Feb 2026' },
    { year: 2026, month: 2, label: 'Mar 2026' },
    { year: 2026, month: 3, label: 'Abr 2026' },
    { year: 2026, month: 4, label: 'May 2026' },
    { year: 2026, month: 5, label: 'Jun 2026' },
    { year: 2026, month: 6, label: 'Jul 2026' },
    { year: 2026, month: 7, label: 'Ago 2026' },
  ];

  histDates.forEach((d, idx) => {
    // Seasonal factor: Winter peak (Jun-Ago in Southern hemisphere)
    const seasonal = Math.sin((d.month - 2) * (Math.PI / 6)) * 0.09;
    const noise = Math.sin((idx + district.id) * 1.7) * 0.03;
    const value = Math.round(baseDemand * (1 + (idx - 11) * growthRate + seasonal + noise));
    const mStr = `${d.year}-${String(d.month + 1).padStart(2, '0')}`;
    results.push({
      monthKey: mStr,
      label: d.label,
      historicalValue: value,
      predictedValue: value,
      lowerConfidence: Math.round(value * 0.96),
      upperConfidence: Math.round(value * 1.04),
      isForecast: false
    });
  });

  // Generate Forecast Months (Set 2026 - Feb 2027)
  const forecastDates = [
    { year: 2026, month: 8, label: 'Set 2026 (+1m)' },
    { year: 2026, month: 9, label: 'Oct 2026 (+2m)' },
    { year: 2026, month: 10, label: 'Nov 2026 (+3m)' },
    { year: 2026, month: 11, label: 'Dic 2026 (+4m)' },
    { year: 2027, month: 0, label: 'Ene 2027 (+5m)' },
    { year: 2027, month: 1, label: 'Feb 2027 (+6m)' },
  ].slice(0, monthsHorizon);

  forecastDates.forEach((d, idx) => {
    const totalStep = 12 + idx;
    const seasonal = Math.sin((d.month - 2) * (Math.PI / 6)) * 0.08;
    const val = Math.round(baseDemand * (1 + (totalStep - 11) * growthRate + seasonal));
    // Uncertainty widens over horizon (+- 5% up to +- 12%)
    const uncertaintyBand = 0.04 + (idx * 0.016);
    const mStr = `${d.year}-${String(d.month + 1).padStart(2, '0')}`;
    results.push({
      monthKey: mStr,
      label: d.label,
      historicalValue: null,
      predictedValue: val,
      lowerConfidence: Math.round(val * (1 - uncertaintyBand)),
      upperConfidence: Math.round(val * (1 + uncertaintyBand)),
      isForecast: true
    });
  });

  return results;
}

export function getRiskFactorsExplanation(district: Territory): RiskFactorExplication[] {
  const sdoh = district.sdoh;
  const current = district.currentState;

  return [
    {
      factor: 'Vulnerabilidad Social y Pobreza (SDOH)',
      category: 'SDOH',
      weight: 0.35,
      score: sdoh.vulnerabilityIndex,
      impact: sdoh.vulnerabilityIndex > 0.65 ? 'Alto Aumento de Riesgo' : sdoh.vulnerabilityIndex > 0.4 ? 'Moderado' : 'Factor Protector',
      description: `Tasa de pobreza del ${(sdoh.povertyRate * 100).toFixed(0)}% y déficit de agua/saneamiento del ${(sdoh.sanitationDeficit * 100).toFixed(0)}% condicionan alta morbimortalidad basal.`
    },
    {
      factor: 'Déficit de Accesibilidad Geográfica',
      category: 'Accesibilidad',
      weight: 0.25,
      score: 1 - current.accessibilityIndex,
      impact: current.accessibilityIndex < 0.5 ? 'Alto Aumento de Riesgo' : current.accessibilityIndex < 0.75 ? 'Moderado' : 'Factor Protector',
      description: `Tiempo medio de traslado a primer nivel es de ${current.avgTravelTimeMinutes.toFixed(1)} min. Índice de conectividad territorial: ${(current.accessibilityIndex * 100).toFixed(0)}%.`
    },
    {
      factor: 'Presión y Sobrecarga Asistencial',
      category: 'Infraestructura',
      weight: 0.20,
      score: Math.min(current.systemPressure / 1.5, 1),
      impact: current.systemPressure > 1.15 ? 'Alto Aumento de Riesgo' : current.systemPressure > 0.9 ? 'Moderado' : 'Factor Protector',
      description: `Ratio de demanda / capacidad instalada de ${(current.systemPressure * 100).toFixed(0)}% en las ${district.activeFacilitiesCount} IPRESS operativas del distrito.`
    },
    {
      factor: 'Densidad Poblacional y Hacinamiento',
      category: 'Demanda',
      weight: 0.12,
      score: Math.min(district.density / 15000, 1),
      impact: district.density > 8000 ? 'Alto Aumento de Riesgo' : district.density > 3000 ? 'Moderado' : 'Factor Protector',
      description: `Densidad de ${district.density.toLocaleString()} hab/km² con ${(sdoh.overcrowdingRate * 100).toFixed(0)}% de hacinamiento crítico intradomiciliario.`
    },
    {
      factor: 'Efecto de Desbordamiento Espacial (GNN Neighbor Spillover)',
      category: 'Espacial',
      weight: 0.08,
      score: current.contagionRisk,
      impact: current.contagionRisk > 0.7 ? 'Alto Aumento de Riesgo' : 'Moderado',
      description: `Presión cruzada y transferencia de pacientes provenientes de los distritos limítrofes (${district.neighborIds.length} conexiones en el grafo metropolitano).`
    }
  ];
}
