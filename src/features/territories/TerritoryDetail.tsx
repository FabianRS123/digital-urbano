import React, { useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';
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
import { DataSourceItem, HealthFacility, Territory } from '../../types';
import {
  generateDistrictTimeSeries,
  getRiskFactorsExplanation,
} from '../../lib/spatiotemporalGnn';
import { DictamenReport } from '../dictamen/DictamenReport';
import { useDictamen } from '../dictamen/useDictamen';
import { useLangflowRecomendacion } from '../dictamen/useLangflowRecomendacion';
import { useChartTheme } from '../../components/charts/chartTheme';
import { ViewContainer } from '../../components/layout/AppShell';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Callout,
  Meter,
  PageHeader,
  Pill,
  Select,
  StatCard,
} from '../../components/ui';
import { formatNumber, formatPercent } from '../../lib/format';
import { getRiskBadgeClass, getRiskLevel } from '../../lib/risk';

interface TerritoryDetailProps {
  territories: Territory[];
  datasetVersion: string;
  sources: DataSourceItem[];
  selectedDistrictId: number;
  facilities: HealthFacility[];
  onSelectDistrict: (id: number) => void;
  onOpenSimulatorForDistrict: (districtId: number) => void;
}

export const TerritoryDetail: React.FC<TerritoryDetailProps> = ({
  territories,
  datasetVersion,
  sources,
  selectedDistrictId,
  facilities,
  onSelectDistrict,
  onOpenSimulatorForDistrict,
}) => {
  const chart = useChartTheme();
  const district =
    territories.find((t) => t.id === selectedDistrictId) ?? territories[0];
  const districtFacilities = facilities.filter(
    (f) => f.districtId === district.id,
  );
  const riskFactors = getRiskFactorsExplanation(district);

  // La banda de incertidumbre se dibuja como un área de rango [inferior, superior]:
  // así no depende de pintar encima con el color del fondo.
  const timeSeries = generateDistrictTimeSeries(district, 6).map((pt) => ({
    ...pt,
    banda: [pt.lowerConfidence, pt.upperConfidence] as [number | null, number | null],
  }));

  const { dictamen, loading: dictamenLoading, error: dictamenError, generar, limpiar } =
    useDictamen();
  const {
    texto: recomendacionLangflow,
    loading: langflowLoading,
    error: langflowError,
    generar: generarLangflow,
  } = useLangflowRecomendacion();

  // El informe se muestra al final de la vista: al generarse, se lleva la
  // pantalla hasta él para que no quede fuera de la vista del usuario.
  const informeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (dictamen) {
      informeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [dictamen]);

  // Un dictamen pertenece a un distrito: al cambiar de distrito se descarta.
  useEffect(() => {
    limpiar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [district.id, district.currentState.monthKey, datasetVersion]);

  const score = district.currentState.priorityIndex;

  return (
    <ViewContainer>
      <PageHeader
        eyebrow="Panorama"
        title={`Distrito de ${district.name}`}
        description={`Provincia de ${district.province}, ${district.department} · ${district.areaKm2.toFixed(1)} km² · ${formatNumber(district.density)} hab/km²`}
        actions={
          <>
            <Badge className={getRiskBadgeClass(score)} mono>
              Prioridad {formatPercent(score)} · {getRiskLevel(score)}
            </Badge>
            <Pill>UBIGEO {district.code}</Pill>
            <div className="w-[200px]">
              <Select
                value={district.id}
                onChange={(e) => onSelectDistrict(parseInt(e.target.value, 10))}
                aria-label="Cambiar territorio"
              >
                {territories.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · {formatPercent(t.currentState.priorityIndex)}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={() => onOpenSimulatorForDistrict(district.id)}
            >
              Simular intervención
            </Button>
          </>
        }
      />

      <Card><CardBody className="space-y-1 p-4 text-xs text-muted-foreground">
        <strong className="text-foreground">Procedencia · versión {datasetVersion} · mes SIS {district.currentState.monthKey}</strong>
        <p>Pobreza INEI 2018: intervalo publicado {district.povertyInterval?.[0]?.toFixed(1) ?? 'Sin dato'} % – {district.povertyInterval?.[1]?.toFixed(1) ?? 'Sin dato'} %; punto medio usado en el modelo {formatPercent(district.sdoh.povertyRate, 1)}.</p>
        {Object.entries(district.provenance ?? {}).map(([indicator, provenance]) => <p key={indicator}>
          {indicator}: {provenance.origin ?? 'Sin dato'} · {provenance.period} · {provenance.method ?? ''} ·{' '}
          {(provenance.sourceIds ?? []).map((id) => { const source = sources.find((item) => item.id === id);
            return source ? <a key={id} className="underline" href={source.pageUrl} target="_blank" rel="noreferrer">{source.name} </a> : null; })}
        </p>)}
      </CardBody></Card>

      {/* Indicadores del distrito --------------------------------------- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Población"
          value={formatNumber(district.population)}
          unit="hab"
          hint={`Población proyectada INEI ${district.currentState.monthKey.slice(0, 4)}`}
        />
        <StatCard
          label="Pobreza INEI 2018"
          value={formatPercent(district.sdoh.vulnerabilityIndex)}
          hint={`Quintil distrital ${district.sdoh.vulnerabilityQuintile} · punto medio del intervalo`}
        />
        <StatCard
          label="Accesibilidad"
          value={formatPercent(district.currentState.accessibilityIndex)}
          hint={district.currentState.avgTravelTimeMinutes === null ? 'Sin IPRESS pública localizable' : `${district.currentState.avgTravelTimeMinutes.toFixed(1)} min aprox. · ${district.currentState.avgDistanceKm?.toFixed(1)} km geográficos`}
        />
        <StatCard
          label="Presión SIS / referencia"
          value={formatPercent(district.currentState.systemPressure)}
          hint={`${formatNumber(district.currentState.historicalDemand)} consultas SIS / ${formatNumber(district.currentState.healthcareCapacity)} referencia estimada`}
          accent={district.currentState.systemPressure > 1}
        />
      </div>

      {/* Serie temporal + SDOH ------------------------------------------ */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader>
            <CardTitle hint="Consultas SIS observadas y persistencia estacional">
              Serie de consultas externas SIS
            </CardTitle>
            <Badge tone="outline" mono>
              Persistencia estacional
            </Badge>
          </CardHeader>
          <CardBody className="pt-4">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={timeSeries}
                  margin={{ top: 6, right: 8, left: -18, bottom: 0 }}
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
                    name="Rango empírico P90 del error retrospectivo"
                    stroke="none"
                    fill={chart.series[2]}
                    fillOpacity={0.14}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="historicalValue"
                    name="Consultas SIS observadas"
                    stroke={chart.series[0]}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="predictedValue"
                    name="Persistencia estacional"
                    stroke={chart.series[2]}
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-border pt-3 text-[10.5px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span
                  className="h-0.5 w-4 rounded"
                  style={{ backgroundColor: chart.series[0] }}
                />
                Demanda observada
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
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2 w-4 rounded-sm"
                  style={{ backgroundColor: chart.series[2], opacity: 0.16 }}
                />
                Intervalo de confianza
              </span>
            </div>
          </CardBody>
        </Card>

        <Card className="xl:col-span-5">
          <CardHeader>
            <CardTitle hint="Pobreza INEI 2018; los demás determinantes no tienen fuente integrada">
              Determinantes sociales de la salud
            </CardTitle>
            <Badge tone="outline" mono>
              Q{district.sdoh.vulnerabilityQuintile}
            </Badge>
          </CardHeader>
          <CardBody className="space-y-3.5 pt-4">
            <SdohBar
              label="Pobreza monetaria"
              value={district.sdoh.povertyRate}
              reference={territories.reduce((sum, item) => sum + item.sdoh.povertyRate, 0) / territories.length}
            />
            <SdohBar
              label="Déficit de agua potable"
              value={district.sdoh.waterAccessDeficit}
              reference={null}
            />
            <SdohBar
              label="Déficit de saneamiento"
              value={district.sdoh.sanitationDeficit}
              reference={null}
            />
            <SdohBar
              label="Hacinamiento crítico"
              value={district.sdoh.overcrowdingRate}
              reference={null}
            />
            <SdohBar
              label="Vivienda precaria o informal"
              value={district.sdoh.precariousHousingPct}
              reference={null}
            />
            <SdohBar
              label="Analfabetismo"
              value={district.sdoh.illiteracyRate}
              reference={null}
            />
          </CardBody>
        </Card>
      </div>

      {/* Factores de riesgo + IPRESS ------------------------------------- */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Card className="xl:col-span-6">
          <CardHeader>
            <CardTitle hint="Descomposición directa de la fórmula de prioridad">
              Descomposición del riesgo territorial
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-2.5 pt-4">
            {riskFactors.map((factor) => (
              <div
                key={factor.factor}
                className="rounded-lg border border-border bg-surface-sunken/60 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="text-[12px] font-semibold text-foreground">
                    {factor.factor}
                  </span>
                  <Badge
                    tone={
                      factor.impact.includes('Alto')
                        ? 'negative'
                        : factor.impact.includes('Moderado')
                          ? 'warning'
                          : 'positive'
                    }
                  >
                    {factor.impact}
                  </Badge>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  {factor.description}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Meter value={factor.weight / 0.4} className="h-1 flex-1" />
                  <span className="numeric shrink-0 text-[10px] font-semibold text-muted-foreground">
                    {formatPercent(factor.weight)} de peso
                  </span>
                </div>
              </div>
            ))}

            <Callout className="mt-3">
              La importancia de variables describe asociaciones espaciales; no
              implica causalidad epidemiológica directa.
            </Callout>
          </CardBody>
        </Card>

        <Card className="xl:col-span-6">
          <CardHeader>
            <CardTitle
              hint={`Capacidad instalada: ${formatNumber(district.currentState.healthcareCapacity)} atenciones al mes`}
            >
              Infraestructura sanitaria ({districtFacilities.length})
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-3 pt-4">
            <ul className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
              {districtFacilities.map((facility) => (
                <li
                  key={facility.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface-sunken/60 p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[12px] font-semibold text-foreground">
                        {facility.name}
                      </span>
                      {facility.isDemo && <Badge tone="outline">Demo</Badge>}
                    </div>
                    <div className="mt-0.5 text-[10.5px] text-muted-foreground">
                      Cat. {facility.category} · {facility.schedule} ·{' '}
                      {facility.consultingRooms} consultorios
                    </div>
                    <div className="mt-1 truncate text-[10px] text-subtle-foreground">
                      {facility.address}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge
                      tone={
                        facility.operationalStatus === 'Sobrecargado'
                          ? 'negative'
                          : 'positive'
                      }
                    >
                      {facility.operationalStatus}
                    </Badge>
                    <div className="numeric mt-1 text-[10px] text-muted-foreground">
                      {formatPercent(facility.pressureRatio)} de carga
                    </div>
                  </div>
                </li>
              ))}
              {districtFacilities.length === 0 && (
                <li className="rounded-lg border border-dashed border-border p-6 text-center text-[11.5px] text-muted-foreground">
                  No hay IPRESS registradas en este distrito.
                </li>
              )}
            </ul>

            <div className="border-t border-border pt-3">
              <Button
                variant="primary"
                onClick={() => generar(district.id, 'Investigador', datasetVersion, district.currentState.monthKey)}
                disabled={dictamenLoading}
                className="w-full justify-center"
              >
                <Sparkles className="size-3.5" />
                {dictamenLoading
                  ? 'Generando dictamen técnico…'
                  : 'Generar dictamen epidemiológico'}
              </Button>
              {dictamenError && (
                <p className="mt-2 text-[11px] text-negative">{dictamenError}</p>
              )}
              {dictamen && !dictamenLoading && (
                <button
                  type="button"
                  onClick={() =>
                    informeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                  className="mt-2 w-full cursor-pointer text-center text-[11.5px] font-semibold text-primary hover:underline"
                >
                  Dictamen generado · Ver informe completo ↓
                </button>
              )}
              <Button
                variant="secondary"
                onClick={() => generarLangflow(district.id, datasetVersion, district.currentState.monthKey)}
                disabled={langflowLoading}
                className="mt-2 w-full justify-center"
              >
                {langflowLoading
                  ? 'Consultando Langflow…'
                  : 'Recomendación operativa (Langflow)'}
              </Button>
              {langflowError && (
                <p className="mt-2 text-[11px] text-negative">{langflowError}</p>
              )}
              {recomendacionLangflow && !langflowLoading && (
                <p className="mt-2 whitespace-pre-wrap text-[11.5px] leading-relaxed text-foreground">
                  {recomendacionLangflow}
                </p>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      {dictamen && (
        <div ref={informeRef} className="scroll-mt-4">
          <DictamenReport dictamen={dictamen} />
        </div>
      )}
    </ViewContainer>
  );
};

/* -------------------------------------------------------------------------- */

const SdohBar: React.FC<{
  label: string;
  value: number | null;
  reference: number | null;
}> = ({ label, value, reference }) => {
  const aboveAverage = value !== null && reference !== null && value > reference;
  if (value === null) return <div className="flex justify-between text-xs"><span>{label}</span><span>Sin dato</span></div>;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-[11.5px]">
        <span className="text-foreground">{label}</span>
        <span className="numeric flex items-baseline gap-1.5">
          <span
            className={
              aboveAverage
                ? 'font-semibold text-negative'
                : 'font-semibold text-positive'
            }
          >
            {formatPercent(value)}
          </span>
          <span className="text-[10px] text-subtle-foreground">
            {reference === null ? '' : `prom. ${formatPercent(reference)}`}
          </span>
        </span>
      </div>
      <Meter
        value={value}
        reference={reference ?? undefined}
        referenceLabel={reference === null ? undefined : `Promedio metropolitano: ${formatPercent(reference)}`}
        barClassName={aboveAverage ? 'bg-negative' : 'bg-primary'}
      />
    </div>
  );
};
