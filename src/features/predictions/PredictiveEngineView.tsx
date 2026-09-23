import React, { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Territory } from '../../types';
import { generateDistrictTimeSeries } from '../../lib/spatiotemporalGnn';
import { useChartTheme } from '../../components/charts/chartTheme';
import { ViewContainer } from '../../components/layout/AppShell';
import { Card, CardBody, CardHeader, CardTitle, PageHeader, SegmentedControl, Select } from '../../components/ui';
import { formatNumber } from '../../lib/format';

interface Props { territories: Territory[]; selectedDistrictId: number; onSelectDistrict: (id: number) => void }

export const PredictiveEngineView: React.FC<Props> = ({ territories, selectedDistrictId, onSelectDistrict }) => {
  const chart = useChartTheme();
  const [horizon, setHorizon] = useState(3);
  const district = territories.find((item) => item.id === selectedDistrictId) ?? territories[0];
  const series = generateDistrictTimeSeries(district, horizon);
  return <ViewContainer>
    <PageHeader eyebrow="Analítica" title="Proyección de consultas externas SIS" description="Persistencia estacional: se usa el valor observado del mismo mes del año anterior. Cuando falta, se usa el último mes observado." />
    <Card><CardBody className="flex flex-wrap items-center gap-4 p-4"><Select value={district.id} onChange={(event) => onSelectDistrict(Number(event.target.value))}>{territories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select><SegmentedControl<number> label="Horizonte" value={horizon} onChange={setHorizon} options={[{ value: 1, label: '+1 mes' }, { value: 3, label: '+3 meses' }, { value: 6, label: '+6 meses' }]} /></CardBody></Card>
    <Card><CardHeader><CardTitle>Historial SIS y persistencia estacional · {district.name}</CardTitle><span className="text-xs text-muted-foreground">Último mes: {district.currentState.monthKey} · {formatNumber(district.currentState.historicalDemand)} consultas</span></CardHeader><CardBody><div className="h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={series}><CartesianGrid stroke={chart.grid} vertical={false} /><XAxis dataKey="label" /><YAxis /><Tooltip formatter={(value: unknown) => `${formatNumber(Number(value))} consultas`} /><Line dataKey="historicalValue" name="SIS observado" stroke={chart.series[0]} dot={false} /><Line dataKey="predictedValue" name="Persistencia estacional" stroke={chart.series[2]} strokeDasharray="4 3" /></LineChart></ResponsiveContainer></div></CardBody></Card>
    <Card><CardBody className="space-y-2 p-4 text-sm"><p>La serie procede de la suma de ATENCIONES con COD_SERVICIO 56. Son consultas de asegurados SIS, no pacientes únicos.</p><p>La comparación temporal con la persistencia del último mes se presenta en Modelos. No se ha entrenado una red neuronal para esta versión.</p><p>Los intervalos y efectos de intervenciones requieren validación externa antes de usarse para decisiones clínicas o presupuestales.</p></CardBody></Card>
  </ViewContainer>;
};
