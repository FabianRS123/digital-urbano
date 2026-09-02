import React, { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Territory } from '../../types';
import { generateDistrictTimeSeries } from '../../lib/spatiotemporalGnn';
import { useChartTheme } from '../../components/charts/chartTheme';
import { ViewContainer } from '../../components/layout/AppShell';
import {
  Badge,
  Callout,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Meter,
  PageHeader,
  Pill,
  SegmentedControl,
  Select,
} from '../../components/ui';
import { formatNumber } from '../../lib/format';

interface PredictiveEngineViewProps {
  territories: Territory[];
  selectedDistrictId: number;
  onSelectDistrict: (id: number) => void;
}

const FEATURE_ATTRIBUTION = [
  { label: 'Demanda histórica en lags (t-1, t-2, t-12)', weight: 0.38 },
  { label: 'Vulnerabilidad social y pobreza (SDOH)', weight: 0.24 },
  { label: 'Déficit de accesibilidad y distancia a IPRESS', weight: 0.18 },
  { label: 'Sobrecarga en la red de distritos vecinos', weight: 0.12 },
  { label: 'Estacionalidad climatológica y feriados', weight: 0.08 },
];

export const PredictiveEngineView: React.FC<PredictiveEngineViewProps> = ({
  territories,
  selectedDistrictId,
  onSelectDistrict,
}) => {
  const chart = useChartTheme();
  const [horizon, setHorizon] = useState(6);
  const [confidence, setConfidence] = useState<'90' | '95'>('90');

  const district =
    territories.find((t) => t.id === selectedDistrictId) ?? territories[0];

  const series = generateDistrictTimeSeries(district, horizon).map((pt) => {
    if (!pt.isForecast) {
      return { ...pt, banda: [pt.lowerConfidence, pt.upperConfidence] as [number, number] };
    }
    const multiplier = confidence === '95' ? 1.35 : 1;
    const spread = (pt.upperConfidence - pt.predictedValue) * multiplier;
    return {
      ...pt,
      lowerConfidence: Math.round(pt.predictedValue - spread),
      upperConfidence: Math.round(pt.predictedValue + spread),
      banda: [
        Math.round(pt.predictedValue - spread),
        Math.round(pt.predictedValue + spread),
      ] as [number, number],
    };
  });

  const maxWeight = Math.max(...FEATURE_ATTRIBUTION.map((f) => f.weight));

  return (
    <ViewContainer>
      <PageHeader
        eyebrow="Analítica"
        title="Motor predictivo espacio-temporal"
        description="Red neuronal en grafos con atención temporal (GAT + Bi-LSTM) para proyectar la demanda sanitaria distrital."
        actions={
          <>
            <Pill>GAT + Bi-LSTM</Pill>
            <Badge tone="outline" mono>
              MAE 228.4
            </Badge>
            <Badge tone="primary" mono>
              R² 0.942
            </Badge>
          </>
        }
      />

      {/* Controles ------------------------------------------------------- */}
      <Card>
        <CardBody className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Territorio
            </span>
            <div className="w-[260px] max-w-full">
              <Select
                value={district.id}
                onChange={(e) => onSelectDistrict(parseInt(e.target.value, 10))}
                aria-label="Territorio objetivo"
              >
                {territories.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · {formatNumber(t.population)} hab
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <SegmentedControl<number>
              label="Horizonte"
              value={horizon}
              onChange={setHorizon}
              options={[
                { value: 1, label: '+1 mes' },
                { value: 3, label: '+3 meses' },
                { value: 6, label: '+6 meses' },
              ]}
            />
            <SegmentedControl<'90' | '95'>
              label="Confianza"
              value={confidence}
              onChange={setConfidence}
              options={[
                { value: '90', label: '90 %' },
                { value: '95', label: '95 %' },
              ]}
            />
          </div>
        </CardBody>
      </Card>

      {/* Proyección ------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle
            hint={`Horizonte t+${horizon} meses con intervalo de incertidumbre al ${confidence} %`}
          >
            Proyección de demanda — {district.name}
          </CardTitle>
          <div className="text-[11px] text-muted-foreground">
            Último dato real:{' '}
            <span className="numeric font-semibold text-foreground">
              {formatNumber(district.currentState.historicalDemand)} atenciones
            </span>
          </div>
        </CardHeader>
        <CardBody className="pt-4">
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={series}
                margin={{ top: 6, right: 12, left: -14, bottom: 0 }}
              >
                <CartesianGrid stroke={chart.grid} vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke={chart.axis}
                  tickLine={false}
                  axisLine={false}
                  tick={chart.axisTick}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke={chart.axis}
                  tickLine={false}
                  axisLine={false}
                  tick={chart.axisTick}
                  tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  contentStyle={chart.tooltip}
                  labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                  formatter={(value: unknown, name: string) => {
                    if (Array.isArray(value)) {
                      return [
                        `${formatNumber(Number(value[0]))} – ${formatNumber(Number(value[1]))}`,
                        name,
                      ];
                    }
                    return [`${formatNumber(Number(value))} atenciones`, name];
                  }}
                />
                <Area
                  dataKey="banda"
                  name={`Intervalo ${confidence} %`}
                  stroke="none"
                  fill={chart.series[2]}
                  fillOpacity={0.14}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="historicalValue"
                  name="Demanda observada"
                  stroke={chart.series[0]}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="predictedValue"
                  name="Proyección ST-GNN"
                  stroke={chart.series[2]}
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={{ r: 2.5, strokeWidth: 0, fill: chart.series[2] }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>

      {/* Grafo + atribución --------------------------------------------- */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Card className="xl:col-span-6">
          <CardHeader>
            <CardTitle hint="Matriz de adyacencia W del grafo metropolitano">
              Grafo de vecindad y difusión espacial
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-3 pt-4">
            <p className="text-[11.5px] leading-relaxed text-muted-foreground">
              El modelo propaga la demanda sanitaria considerando los flujos de
              pacientes desde los distritos colindantes a{' '}
              <span className="font-semibold text-foreground">
                {district.name}
              </span>
              .
            </p>
            <ul className="space-y-2">
              {district.neighborIds.map((id) => {
                const neighbor = territories.find((t) => t.id === id);
                if (!neighbor) return null;
                return (
                  <li
                    key={id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-sunken/60 px-3 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                      <span className="truncate text-[12px] font-semibold text-foreground">
                        {neighbor.name}
                      </span>
                      <Pill>{neighbor.code}</Pill>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-[10.5px] text-muted-foreground">
                      <span className="numeric">
                        {formatNumber(neighbor.currentState.historicalDemand)}{' '}
                        atenciones
                      </span>
                      <Badge tone="outline" mono>
                        W{' '}
                        {(
                          1 / Math.max(district.neighborIds.length, 1)
                        ).toFixed(2)}
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>

        <Card className="xl:col-span-6">
          <CardHeader>
            <CardTitle hint="Mecanismo de atención espacio-temporal">
              Importancia de variables
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-3.5 pt-4">
            {FEATURE_ATTRIBUTION.map((feature) => (
              <div key={feature.label} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3 text-[11.5px]">
                  <span className="text-foreground">{feature.label}</span>
                  <span className="numeric shrink-0 font-semibold text-primary">
                    {(feature.weight * 100).toFixed(0)} %
                  </span>
                </div>
                <Meter value={feature.weight / maxWeight} />
              </div>
            ))}

            <Callout
              tone="warning"
              icon={<ShieldAlert className="size-4" />}
              title="Nota ética"
              className="mt-4"
            >
              Las proyecciones son insumos probabilísticos para optimizar
              recursos logísticos. No deben utilizarse para denegar cobertura ni
              restringir el acceso a servicios de salud.
            </Callout>
          </CardBody>
        </Card>
      </div>
    </ViewContainer>
  );
};
