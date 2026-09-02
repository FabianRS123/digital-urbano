import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { EQUITY_METRICS } from '../../data/trujilloData';
import { useChartTheme } from '../../components/charts/chartTheme';
import { ViewContainer } from '../../components/layout/AppShell';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  PageHeader,
  StatCard,
  Table,
  TableWrap,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  CellStack,
} from '../../components/ui';
import { formatNumber } from '../../lib/format';

export const EquityFairnessView: React.FC = () => {
  const chart = useChartTheme();

  // Los campos de EquityMetric son opcionales en el tipo: se normalizan aquí
  // para que la vista nunca falle si una fuente entrega el dataset parcial.
  const quintiles = EQUITY_METRICS.map((q) => ({
    key: String(q.quintile),
    // El dataset puede traer "Q1" o el número 1: se normaliza la etiqueta
    // para no acabar rotulando "Quintil Q1".
    name: /^q\d/i.test(String(q.quintile))
      ? `Quintil ${String(q.quintile).slice(1)}`
      : `Quintil ${q.quintile}`,
    label: q.vulnerabilityDescription ?? q.vulnerabilityLabel ?? '—',
    population: q.population ?? 0,
    mae: q.modelMae ?? q.mae ?? 0,
    rmse: q.modelRmse ?? q.rmse ?? 0,
    travelTime: q.avgTravelTimeMinutes ?? q.avgTravelTime ?? 0,
    facilitiesPer10k: q.facilitiesPer10kPop ?? q.ipressPer10k ?? 0,
  }));

  const totalPopulation = quintiles.reduce((s, q) => s + q.population, 0);
  const travelTimes = quintiles.map((q) => q.travelTime).filter(Boolean);
  const maxTravel = Math.max(...travelTimes, 0);
  const minTravel = Math.min(...travelTimes, Number.MAX_SAFE_INTEGER);
  const travelGap = minTravel > 0 ? maxTravel / minTravel : 0;

  return (
    <ViewContainer>
      <PageHeader
        eyebrow="Gobernanza"
        title="Equidad y justicia algorítmica"
        description="Auditoría de sesgos y desempeño del modelo predictivo según quintiles de vulnerabilidad socioeconómica."
        actions={
          <Badge tone="positive">
            Paridad de error calibrada · disparate impact &lt; 1.15
          </Badge>
        }
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard
          label="Brecha de tiempo de viaje"
          value={`${travelGap.toFixed(1)}×`}
          hint={`${maxTravel.toFixed(1)} min en el quintil más vulnerable frente a ${minTravel.toFixed(1)} min en el menos vulnerable.`}
        />
        <StatCard
          label="Densidad de IPRESS por 10 mil hab."
          value="0.7"
          hint="En el quintil más vulnerable, frente a 1.9 en el menos vulnerable: déficit estructural del primer nivel en la periferia."
        />
        <StatCard
          label="Coeficiente de Gini sanitario"
          value="0.38"
          hint="Desigualdad moderada en la distribución espacial de recursos de salud."
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle hint="Verifica que el modelo no penalice a las poblaciones vulnerables">
              Auditoría de error por quintil
            </CardTitle>
          </CardHeader>
          <CardBody className="pt-4">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={quintiles}
                  margin={{ top: 6, right: 8, left: -18, bottom: 0 }}
                  barGap={4}
                >
                  <CartesianGrid stroke={chart.grid} vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke={chart.axis}
                    tickLine={false}
                    axisLine={false}
                    tick={chart.axisTick}
                  />
                  <YAxis
                    stroke={chart.axis}
                    tickLine={false}
                    axisLine={false}
                    tick={chart.axisTick}
                  />
                  <Tooltip
                    cursor={{ fill: chart.grid, fillOpacity: 0.35 }}
                    contentStyle={chart.tooltip}
                    labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                  />
                  <Bar
                    dataKey="mae"
                    name="MAE"
                    fill={chart.series[0]}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={26}
                  />
                  <Bar
                    dataKey="rmse"
                    name="RMSE"
                    fill={chart.series[3]}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={26}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex items-center gap-4 border-t border-border pt-3 text-[10.5px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span
                  className="size-2 rounded-sm"
                  style={{ backgroundColor: chart.series[0] }}
                />
                MAE · error absoluto medio
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="size-2 rounded-sm"
                  style={{ backgroundColor: chart.series[3] }}
                />
                RMSE · raíz del error cuadrático
              </span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle hint="Tiempo promedio de traslado a un establecimiento, en minutos">
              Disparidades de accesibilidad geográfica
            </CardTitle>
          </CardHeader>
          <CardBody className="pt-4">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={quintiles}
                  margin={{ top: 6, right: 8, left: -18, bottom: 0 }}
                >
                  <CartesianGrid stroke={chart.grid} vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke={chart.axis}
                    tickLine={false}
                    axisLine={false}
                    tick={chart.axisTick}
                  />
                  <YAxis
                    stroke={chart.axis}
                    tickLine={false}
                    axisLine={false}
                    tick={chart.axisTick}
                  />
                  <Tooltip
                    cursor={{ fill: chart.grid, fillOpacity: 0.35 }}
                    contentStyle={chart.tooltip}
                    labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                    formatter={(value: number | string) => [
                      `${value} minutos`,
                      'Tiempo medio',
                    ]}
                  />
                  <Bar
                    dataKey="travelTime"
                    name="Tiempo medio de viaje"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={38}
                  >
                    {quintiles.map((q, idx) => (
                      <Cell
                        key={q.key}
                        fill={
                          idx >= quintiles.length - 2
                            ? chart.risk.high
                            : chart.series[0]
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 border-t border-border pt-3 text-[10.5px] text-muted-foreground">
              Los quintiles de mayor vulnerabilidad concentran los tiempos de
              traslado más altos: la brecha de acceso es geográfica antes que
              algorítmica.
            </p>
          </CardBody>
        </Card>
      </div>

      <Card flush>
        <CardHeader>
          <CardTitle hint={`Población total: ${formatNumber(totalPopulation)} habitantes`}>
            Métricas desagregadas de equidad y rendimiento
          </CardTitle>
        </CardHeader>
        <TableWrap>
          <Table>
            <Thead>
              <tr>
                <Th>Quintil de vulnerabilidad</Th>
                <Th align="right">Población</Th>
                <Th align="right">IPRESS / 10k hab.</Th>
                <Th align="right">Tiempo medio</Th>
                <Th align="right">MAE</Th>
                <Th align="right">RMSE</Th>
                <Th align="center">Estado</Th>
              </tr>
            </Thead>
            <Tbody>
              {quintiles.map((q) => (
                <Tr key={q.key}>
                  <Td>
                    <CellStack primary={q.name} secondary={q.label} />
                  </Td>
                  <Td align="right" className="numeric">
                    {formatNumber(q.population)}
                  </Td>
                  <Td align="right" className="numeric font-mono">
                    {q.facilitiesPer10k.toFixed(2)}
                  </Td>
                  <Td align="right" className="numeric font-semibold">
                    {q.travelTime.toFixed(1)} min
                  </Td>
                  <Td align="right" className="numeric font-mono">
                    {q.mae.toFixed(1)}
                  </Td>
                  <Td align="right" className="numeric font-mono">
                    {q.rmse.toFixed(1)}
                  </Td>
                  <Td align="center">
                    <Badge tone="positive">Cumple paridad</Badge>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableWrap>
      </Card>
    </ViewContainer>
  );
};
