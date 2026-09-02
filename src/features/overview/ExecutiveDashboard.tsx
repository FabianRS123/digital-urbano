import React from 'react';
import { ArrowRight, ChevronRight, Maximize2 } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { HealthFacility, Territory } from '../../types';
import { NavigationTab } from '../../app/navigation';
import { MetropolitanMap } from '../../components/map/MetropolitanMap';
import { useChartTheme } from '../../components/charts/chartTheme';
import { ViewContainer } from '../../components/layout/AppShell';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CellStack,
  Meter,
  PageHeader,
  StatCard,
  Table,
  TableWrap,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '../../components/ui';
import { formatNumber, formatPercent } from '../../lib/format';
import {
  getRiskBadgeClass,
  getRiskFillClass,
  getRiskLevel,
} from '../../lib/risk';
import { cn } from '../../lib/utils';

interface ExecutiveDashboardProps {
  territories: Territory[];
  facilities: HealthFacility[];
  selectedDistrictId: number | null;
  onSelectDistrict: (id: number) => void;
  onNavigateTab: (tab: NavigationTab) => void;
  currentMonthLabel: string;
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({
  territories,
  facilities,
  selectedDistrictId,
  onSelectDistrict,
  onNavigateTab,
  currentMonthLabel,
}) => {
  const chart = useChartTheme();

  const totalPopulation = territories.reduce((s, t) => s + t.population, 0);
  const totalDemand = territories.reduce(
    (s, t) => s + t.currentState.historicalDemand,
    0,
  );
  const totalProjected = territories.reduce(
    (s, t) => s + t.currentState.projectedDemand,
    0,
  );
  const criticalDistricts = territories.filter(
    (t) => t.currentState.priorityIndex >= 0.8,
  );
  const avgAccessibility =
    territories.reduce((s, t) => s + t.currentState.accessibilityIndex, 0) /
    territories.length;
  const avgTravelTime =
    territories.reduce((s, t) => s + t.currentState.avgTravelTimeMinutes, 0) /
    territories.length;

  const ranking = [...territories].sort(
    (a, b) => b.currentState.priorityIndex - a.currentState.priorityIndex,
  );

  const demandSeries = [
    { month: 'Ene 26', historico: 59800, proyectado: null as number | null },
    { month: 'Feb 26', historico: 61200, proyectado: null },
    { month: 'Mar 26', historico: 62900, proyectado: null },
    { month: 'Abr 26', historico: 63800, proyectado: null },
    { month: 'May 26', historico: 64500, proyectado: null },
    { month: 'Jun 26', historico: 66200, proyectado: null },
    { month: 'Jul 26', historico: 67100, proyectado: null },
    { month: 'Ago 26', historico: totalDemand, proyectado: totalDemand },
    { month: 'Set 26', historico: null, proyectado: totalProjected },
    { month: 'Oct 26', historico: null, proyectado: Math.round(totalProjected * 1.025) },
    { month: 'Nov 26', historico: null, proyectado: Math.round(totalProjected * 1.042) },
    { month: 'Dic 26', historico: null, proyectado: Math.round(totalProjected * 1.06) },
  ];

  return (
    <ViewContainer>
      <PageHeader
        eyebrow="Panorama"
        title="Resumen ejecutivo metropolitano"
        description="Estado consolidado de demanda, accesibilidad y equidad sanitaria en los diez distritos del Área Metropolitana de Trujillo."
        actions={
          <Badge tone="outline" mono>
            {currentMonthLabel}
          </Badge>
        }
      />

      {/* Indicadores clave ---------------------------------------------- */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Población monitorizada"
          value={formatNumber(totalPopulation)}
          delta="+1.2 % a/a"
          deltaTone="neutral"
          hint="10 distritos"
        />
        <StatCard
          label="IPRESS activas"
          value={facilities.length}
          hint="Catálogo RENIPRESS"
        />
        <StatCard
          label="Atenciones del mes"
          value={formatNumber(totalDemand)}
          delta="+3.8 % m/m"
          deltaTone="neutral"
          hint={currentMonthLabel}
        />
        <StatCard
          label="Demanda proyectada"
          value={formatNumber(totalProjected)}
          delta="+4.2 % est."
          deltaTone="neutral"
          hint="ST-GNN t+1"
        />
        <StatCard
          label="Distritos críticos"
          value={criticalDistricts.length}
          hint={
            criticalDistricts.length
              ? criticalDistricts.map((d) => d.name).join(' · ')
              : 'Sin distritos en nivel crítico'
          }
          accent={criticalDistricts.length > 0}
        />
        <StatCard
          label="Accesibilidad media"
          value={formatPercent(avgAccessibility)}
          hint={`${avgTravelTime.toFixed(1)} min de viaje`}
        />
      </div>

      {/* Mapa + ranking -------------------------------------------------- */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Card flush className="flex flex-col xl:col-span-8">
          <CardHeader>
            <CardTitle hint="Coropleta de prioridad sanitaria; haz clic en un distrito para enfocarlo.">
              Estado espacio-temporal del territorio
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={() => onNavigateTab('map')}>
              <Maximize2 className="size-3.5" />
              Pantalla completa
            </Button>
          </CardHeader>
          <MetropolitanMap
            territories={territories}
            facilities={facilities}
            selectedDistrictId={selectedDistrictId}
            onSelectDistrict={onSelectDistrict}
            className="min-h-[480px] flex-1 rounded-none border-0 border-t border-border"
          />
        </Card>

        <div className="flex flex-col gap-5 xl:col-span-4">
          <Card flush className="flex min-h-0 flex-1 flex-col">
            <CardHeader>
              <CardTitle hint="Ordenado por índice de prioridad">
                Ranking de prioridad
              </CardTitle>
              <Button
                variant="link"
                onClick={() => onNavigateTab('hotspots')}
                className="text-[11px]"
              >
                Ver todos
              </Button>
            </CardHeader>

            <ul className="max-h-[400px] divide-y divide-border overflow-y-auto">
              {ranking.map((district, idx) => {
                const score = district.currentState.priorityIndex;
                const selected = district.id === selectedDistrictId;

                return (
                  <li key={district.id}>
                    <button
                      type="button"
                      onClick={() => onSelectDistrict(district.id)}
                      className={cn(
                        'flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors',
                        selected ? 'bg-primary/[0.07]' : 'hover:bg-muted/60',
                      )}
                    >
                      <span className="numeric w-5 shrink-0 font-mono text-[10.5px] text-subtle-foreground">
                        {String(idx + 1).padStart(2, '0')}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 truncate text-[12.5px] font-semibold text-foreground">
                          {district.name}
                        </span>
                        <span className="mt-1 flex items-center gap-2">
                          <Meter
                            value={score}
                            barClassName={getRiskFillClass(score)}
                            className="h-1 w-16"
                          />
                          <span className="truncate text-[10px] text-muted-foreground">
                            {formatNumber(district.population)} hab ·{' '}
                            {district.currentState.avgTravelTimeMinutes} min
                          </span>
                        </span>
                      </span>

                      <span className="flex shrink-0 items-center gap-1.5">
                        <Badge className={getRiskBadgeClass(score)} mono>
                          {formatPercent(score)}
                        </Badge>
                        <ChevronRight className="size-3.5 text-subtle-foreground" />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card className="border-primary/25 bg-primary/[0.05]">
            <CardBody className="space-y-3">
              <h3 className="text-[13px] font-semibold text-foreground">
                Simulador de intervenciones What-If
              </h3>
              <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                Evalúa el impacto de una nueva IPRESS, una ampliación de
                capacidad o una mejora de accesibilidad antes de comprometer
                inversión pública.
              </p>
              <Button
                variant="primary"
                size="sm"
                className="w-full justify-center"
                onClick={() => onNavigateTab('simulator')}
              >
                Configurar simulación
                <ArrowRight className="size-3.5" />
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Serie de demanda + matriz territorial --------------------------- */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Card className="xl:col-span-5">
          <CardHeader>
            <CardTitle hint="Histórico observado frente a proyección ST-GNN">
              Evolución de la demanda sanitaria
            </CardTitle>
            <Button
              variant="link"
              onClick={() => onNavigateTab('predictions')}
              className="text-[11px]"
            >
              Detalle
            </Button>
          </CardHeader>
          <CardBody className="pt-4">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={demandSeries}
                  margin={{ top: 6, right: 8, left: -18, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="gradHist" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chart.series[0]} stopOpacity={0.22} />
                      <stop offset="100%" stopColor={chart.series[0]} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradProy" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chart.series[2]} stopOpacity={0.2} />
                      <stop offset="100%" stopColor={chart.series[2]} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={chart.grid} vertical={false} />
                  <XAxis
                    dataKey="month"
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
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={chart.tooltip}
                    labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                    formatter={(value: number | string) => [
                      `${formatNumber(Number(value))} atenciones`,
                      '',
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="historico"
                    name="Histórico observado"
                    stroke={chart.series[0]}
                    strokeWidth={2}
                    fill="url(#gradHist)"
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="proyectado"
                    name="Proyección ST-GNN"
                    stroke={chart.series[2]}
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    fill="url(#gradProy)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex items-center gap-4 border-t border-border pt-3 text-[10.5px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span
                  className="h-0.5 w-4 rounded"
                  style={{ backgroundColor: chart.series[0] }}
                />
                Histórico observado
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="h-0.5 w-4 rounded"
                  style={{
                    backgroundImage: `repeating-linear-gradient(90deg, ${chart.series[2]} 0 4px, transparent 4px 7px)`,
                  }}
                />
                Proyección ST-GNN
              </span>
            </div>
          </CardBody>
        </Card>

        <Card flush className="xl:col-span-7">
          <CardHeader>
            <CardTitle hint="Cinco territorios con mayor índice de prioridad">
              Matriz de priorización y equidad
            </CardTitle>
            <Button
              variant="link"
              onClick={() => onNavigateTab('territories')}
              className="text-[11px]"
            >
              Explorar distritos
            </Button>
          </CardHeader>

          <TableWrap>
            <Table>
              <Thead>
                <tr>
                  <Th>Distrito</Th>
                  <Th>Vulnerabilidad</Th>
                  <Th>Accesibilidad</Th>
                  <Th>Demanda / capacidad</Th>
                  <Th align="right">Prioridad</Th>
                  <Th align="center" className="w-10">
                    <span className="sr-only">Abrir</span>
                  </Th>
                </tr>
              </Thead>
              <Tbody>
                {ranking.slice(0, 5).map((district) => {
                  const score = district.currentState.priorityIndex;
                  return (
                    <Tr
                      key={district.id}
                      interactive
                      selected={district.id === selectedDistrictId}
                      onClick={() => onSelectDistrict(district.id)}
                    >
                      <Td>
                        <CellStack
                          primary={district.name}
                          secondary={`${formatNumber(district.population)} hab`}
                        />
                      </Td>
                      <Td>
                        <CellStack
                          primary={formatPercent(district.sdoh.vulnerabilityIndex)}
                          secondary={`Quintil ${district.sdoh.vulnerabilityQuintile}`}
                        />
                      </Td>
                      <Td>
                        <CellStack
                          primary={formatPercent(
                            district.currentState.accessibilityIndex,
                          )}
                          secondary={`${district.currentState.avgTravelTimeMinutes} min`}
                        />
                      </Td>
                      <Td>
                        <CellStack
                          primary={formatPercent(
                            district.currentState.systemPressure,
                          )}
                          secondary={`${formatNumber(district.currentState.historicalDemand)} / ${formatNumber(district.currentState.healthcareCapacity)}`}
                        />
                      </Td>
                      <Td align="right">
                        <Badge className={getRiskBadgeClass(score)} mono>
                          {formatPercent(score)} · {getRiskLevel(score)}
                        </Badge>
                      </Td>
                      <Td align="center">
                        <button
                          type="button"
                          aria-label={`Ver detalle de ${district.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectDistrict(district.id);
                            onNavigateTab('territories');
                          }}
                          className="cursor-pointer rounded p-1 text-subtle-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <ChevronRight className="size-4" />
                        </button>
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </TableWrap>
        </Card>
      </div>
    </ViewContainer>
  );
};
