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
import { nextMonth } from '../../lib/officialModel';

interface ExecutiveDashboardProps {
  months: string[];
  territories: Territory[];
  facilities: HealthFacility[];
  selectedDistrictId: number | null;
  onSelectDistrict: (id: number) => void;
  onNavigateTab: (tab: NavigationTab) => void;
  currentMonthLabel: string;
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({
  months,
  territories,
  facilities,
  selectedDistrictId,
  onSelectDistrict,
  onNavigateTab,
  currentMonthLabel,
}) => {
  const chart = useChartTheme();
  const forecastMonth = nextMonth(territories[0].currentState.monthKey);
  const previousYear = `${Number(forecastMonth.slice(0, 4)) - 1}${forecastMonth.slice(4)}`;
  const hasSeasonalReference = territories.every((territory) => territory.history?.[previousYear] !== undefined);

  const totalPopulation = territories.reduce((s, t) => s + t.population, 0);
  const totalDemand = territories.every((t) => t.currentState.historicalDemand !== null)
    ? territories.reduce((sum, t) => sum + t.currentState.historicalDemand!, 0) : null;
  const totalProjected = territories.every((t) => t.currentState.projectedDemand !== null)
    ? territories.reduce((sum, t) => sum + t.currentState.projectedDemand!, 0) : null;
  const criticalDistricts = territories.filter(
    (t) => t.currentState.priorityIndex >= 0.8,
  );
  const accessValues = territories.map((t) => t.currentState.accessibilityIndex).filter((value): value is number => value !== null);
  const travelValues = territories.map((t) => t.currentState.avgTravelTimeMinutes).filter((value): value is number => value !== null);
  const avgAccessibility = accessValues.length ? accessValues.reduce((sum, value) => sum + value, 0) / accessValues.length : null;
  const avgTravelTime = travelValues.length ? travelValues.reduce((sum, value) => sum + value, 0) / travelValues.length : null;

  const ranking = [...territories].sort(
    (a, b) => (b.currentState.priorityIndex ?? -1) - (a.currentState.priorityIndex ?? -1),
  );

  const demandSeries = months.filter((month) => month <= territories[0].currentState.monthKey).slice(-12).map((month) => ({
    month, historico: territories.every((territory) => territory.history?.[month] !== undefined)
      ? territories.reduce((sum, territory) => sum + territory.history![month], 0) : null,
    proyectado: null as number | null,
  }));
  demandSeries.push({ month: 'Próximo mes', historico: null as unknown as number, proyectado: totalProjected });

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
          hint="10 distritos"
        />
        <StatCard
          label="IPRESS registradas"
          value={facilities.length}
          hint="Catálogo RENIPRESS"
        />
        <StatCard
          label="Consultas SIS del mes"
          value={formatNumber(totalDemand)}
          hint={currentMonthLabel}
        />
        <StatCard
          label="Consultas proyectadas"
          value={formatNumber(totalProjected)}
          hint={hasSeasonalReference ? 'Persistencia estacional t+1' : 'Persistencia del último mes (respaldo)'}
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
          hint={avgTravelTime === null ? 'Sin dato' : `${avgTravelTime.toFixed(1)} min de viaje aproximado`}
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
                            {district.currentState.avgTravelTimeMinutes === null ? 'Sin dato' : `${district.currentState.avgTravelTimeMinutes.toFixed(1)} min aprox.`}
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
            <CardTitle hint="Consultas SIS observadas frente a persistencia estacional">
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
                    name="Persistencia estacional"
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
                Persistencia estacional
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
                  <Th>Pobreza 2018</Th>
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
                          secondary={district.currentState.avgTravelTimeMinutes === null ? 'Sin dato' : `${district.currentState.avgTravelTimeMinutes.toFixed(1)} min aprox.`}
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
