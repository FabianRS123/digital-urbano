import React from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { EquityMetric } from '../../types';
import { ViewContainer } from '../../components/layout/AppShell';
import { Card, CardBody, CardHeader, CardTitle, PageHeader, StatCard, Table, TableWrap, Tbody, Td, Th, Thead, Tr } from '../../components/ui';
import { useChartTheme } from '../../components/charts/chartTheme';
import { formatNumber } from '../../lib/format';

export const EquityFairnessView: React.FC<{ metrics: EquityMetric[] }> = ({ metrics }) => {
  const chart = useChartTheme();
  const rows = metrics.map((item) => ({ ...item, name: `Q${item.quintile}`,
    travel: item.avgTravelTimeMinutes ?? null, facilities: item.facilitiesPer10kPop ?? null }));
  const population = rows.reduce((sum, item) => sum + item.population, 0);
  const travelGap = rows[0]?.travel && rows.at(-1)?.travel !== null ? (rows.at(-1)!.travel! / rows[0].travel) : null;
  return <ViewContainer>
    <PageHeader eyebrow="Equidad" title="Distribución territorial del acceso"
      description="Quintiles de dos distritos ordenados por pobreza INEI 2018. Tiempos de viaje y capacidad son estimaciones; no se presentan métricas de error de un modelo no entrenado." />
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <StatCard label="Población analizada" value={formatNumber(population)} hint="Proyección INEI del periodo seleccionado" />
      <StatCard label="Brecha Q5 / Q1 de traslado" value={travelGap === null ? 'Sin dato' : `${travelGap.toFixed(2)}×`}
        hint="Tiempo referencial desde punto distrital" />
      <StatCard label="IPRESS por 10 mil, Q5" value={rows.at(-1)?.facilities === null ? 'Sin dato' : rows.at(-1)?.facilities?.toFixed(2) ?? 'Sin dato'}
        hint="Establecimientos activos con actividad SIS" />
    </div>
    <Card><CardHeader><CardTitle>Tiempo referencial por quintil</CardTitle></CardHeader>
      <CardBody><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={rows}>
        <CartesianGrid stroke={chart.grid} vertical={false} /><XAxis dataKey="name" stroke={chart.axis} />
        <YAxis stroke={chart.axis} /><Tooltip contentStyle={chart.tooltip} />
        <Bar dataKey="travel" name="Minutos estimados" fill={chart.series[0]} />
      </BarChart></ResponsiveContainer></div></CardBody></Card>
    <Card flush><CardHeader><CardTitle>Indicadores por quintil</CardTitle></CardHeader><TableWrap><Table>
      <Thead><tr><Th>Quintil</Th><Th align="right">Población</Th><Th align="right">IPRESS / 10 mil</Th><Th align="right">Traslado estimado</Th></tr></Thead>
      <Tbody>{rows.map((item) => <Tr key={item.name}><Td>{item.name} · {item.vulnerabilityDescription}</Td>
        <Td align="right">{formatNumber(item.population)}</Td><Td align="right">{item.facilities === null ? 'Sin dato' : item.facilities.toFixed(2)}</Td>
        <Td align="right">{item.travel === null ? 'Sin dato' : `${item.travel.toFixed(1)} min`}</Td></Tr>)}</Tbody>
    </Table></TableWrap></Card>
  </ViewContainer>;
};
