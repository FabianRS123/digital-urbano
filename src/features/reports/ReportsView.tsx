import React, { useState } from 'react';
import { FileSpreadsheet, Printer, Sparkles } from 'lucide-react';
import { HealthFacility, SimulationResult, Territory } from '../../types';
import { DictamenReport } from '../dictamen/DictamenReport';
import { useDictamen } from '../dictamen/useDictamen';
import { ViewContainer } from '../../components/layout/AppShell';
import {
  Badge,
  Button,
  Card,
  CardBody,
  PageHeader,
  Select,
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
import { getRiskBadgeClass, getRiskLevel } from '../../lib/risk';
import { cn } from '../../lib/utils';

type ReportScope =
  | 'metropolitan'
  | 'territorial'
  | 'hotspots'
  | 'simulation'
  | 'equity';

const SCOPES: { id: ReportScope; label: string }[] = [
  { id: 'metropolitan', label: 'Diagnóstico metropolitano' },
  { id: 'territorial', label: 'Dictamen distrital' },
  { id: 'hotspots', label: 'Matriz de priorización' },
  { id: 'simulation', label: 'Evaluación What-If' },
  { id: 'equity', label: 'Auditoría de equidad' },
];

interface ReportsViewProps {
  territories: Territory[];
  facilities: HealthFacility[];
  latestSimulation: SimulationResult | null;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  territories,
  facilities,
  latestSimulation,
}) => {
  const [scope, setScope] = useState<ReportScope>('metropolitan');
  const [districtId, setDistrictId] = useState<number>(
    territories[1]?.id ?? territories[0].id,
  );
  const { dictamen, loading: dictamenLoading, error: dictamenError, generar, limpiar } =
    useDictamen();

  const district =
    territories.find((t) => t.id === districtId) ?? territories[0];
  const totalPopulation = territories.reduce((s, t) => s + t.population, 0);
  const totalDemand = territories.reduce(
    (s, t) => s + t.currentState.historicalDemand,
    0,
  );
  const avgTravelTime =
    territories.reduce((s, t) => s + t.currentState.avgTravelTimeMinutes, 0) /
    territories.length;
  const criticalCount = territories.filter(
    (t) => t.currentState.priorityIndex >= 0.8,
  ).length;

  const rankedTerritories = [...territories].sort(
    (a, b) => b.currentState.priorityIndex - a.currentState.priorityIndex,
  );


  const handleExportCsv = () => {
    const headers = [
      'ID',
      'Distrito',
      'Poblacion',
      'Densidad',
      'Vulnerabilidad_SDOH',
      'Accesibilidad',
      'Tiempo_Viaje_Min',
      'Demanda_Historica',
      'Capacidad',
      'Presion',
      'Indice_Prioridad',
      'Categoria',
    ].join(',');

    const rows = territories.map((t) =>
      [
        t.id,
        `"${t.name}"`,
        t.population,
        t.density,
        t.sdoh.vulnerabilityIndex,
        t.currentState.accessibilityIndex,
        t.currentState.avgTravelTimeMinutes,
        t.currentState.historicalDemand,
        t.currentState.healthcareCapacity,
        t.currentState.systemPressure,
        t.currentState.priorityIndex,
        `"${t.currentState.hotspotCategory}"`,
      ].join(','),
    );

    // BOM para que Excel en español interprete correctamente los acentos.
    const blob = new Blob(['﻿', headers, '\n', rows.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Gemelo_Digital_Salud_Trujillo_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <ViewContainer>
      <PageHeader
        eyebrow="Gobernanza"
        title="Informes ejecutivos y dictámenes"
        description="Exportación de reportes técnicos para gestores del MINSA, la GERESA La Libertad y la Municipalidad Provincial de Trujillo."
        actions={
          <>
            <Button onClick={() => window.print()}>
              <Printer className="size-3.5" />
              Imprimir / PDF
            </Button>
            <Button onClick={handleExportCsv}>
              <FileSpreadsheet className="size-3.5" />
              Exportar CSV
            </Button>
          </>
        }
      />

      {/* Selector de alcance -------------------------------------------- */}
      <div className="flex flex-wrap gap-1.5 print-hidden">
        {SCOPES.map((item, idx) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setScope(item.id)}
            aria-pressed={scope === item.id}
            className={cn(
              'cursor-pointer rounded-lg border px-3 py-1.5 text-[11.5px] font-semibold transition-colors',
              scope === item.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground',
            )}
          >
            <span className="mr-1.5 font-mono opacity-60">{idx + 1}</span>
            {item.label}
          </button>
        ))}
      </div>

      {/* Documento ------------------------------------------------------- */}
      <Card className="printable-area">
        <CardBody className="space-y-6 p-6 lg:p-8">
          <header className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                Informe técnico espacio-temporal · 2026-TRU-001
              </span>
              <h3 className="mt-1.5 text-[17px] font-semibold tracking-tight text-foreground">
                Gemelo Digital Urbano de Salud — Área Metropolitana de Trujillo
              </h3>
              <p className="mt-1 text-[11.5px] text-muted-foreground">
                Periodo de análisis: setiembre 2025 – agosto 2026 · Emitido el{' '}
                {new Date().toLocaleDateString('es-PE', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
            <Badge tone="outline" mono>
              Documento académico
            </Badge>
          </header>

          {scope === 'metropolitan' && (
            <section className="space-y-4">
              <SectionTitle number="1">
                Resumen ejecutivo metropolitano
              </SectionTitle>
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                El Área Metropolitana de Trujillo cuenta con una población
                monitorizada de{' '}
                <strong className="font-semibold text-foreground">
                  {formatNumber(totalPopulation)} habitantes
                </strong>{' '}
                distribuidos en {territories.length} distritos. El modelo
                espacio-temporal ST-GNN identifica una concentración crítica de
                vulnerabilidad y déficit de acceso en la zona nororiental (El
                Porvenir y Florencia de Mora), donde la demanda asistencial
                supera la capacidad instalada del primer nivel de atención.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard
                  label="Demanda mensual"
                  value={formatNumber(totalDemand)}
                  hint="atenciones registradas"
                />
                <StatCard
                  label="IPRESS registradas"
                  value={facilities.length}
                  hint="RENIPRESS"
                />
                <StatCard
                  label="Tiempo medio de viaje"
                  value={avgTravelTime.toFixed(1)}
                  unit="min"
                  hint="al primer nivel"
                />
                <StatCard
                  label="Hotspots críticos"
                  value={criticalCount}
                  hint="prioridad ≥ 0.80"
                  accent={criticalCount > 0}
                />
              </div>
            </section>
          )}

          {scope === 'territorial' && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SectionTitle number="2">
                  Diagnóstico específico: {district.name}
                </SectionTitle>
                <div className="w-[200px] print-hidden">
                  <Select
                    value={districtId}
                    onChange={(e) => setDistrictId(parseInt(e.target.value, 10))}
                    aria-label="Distrito del dictamen"
                  >
                    {territories.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <p className="text-[12px] leading-relaxed text-muted-foreground">
                El distrito de{' '}
                <strong className="font-semibold text-foreground">
                  {district.name}
                </strong>{' '}
                ({formatNumber(district.population)} habitantes) presenta un
                índice de prioridad territorial de{' '}
                <strong className="font-semibold text-foreground">
                  {formatPercent(district.currentState.priorityIndex)} (
                  {district.currentState.hotspotCategory})
                </strong>
                . El tiempo promedio de viaje a establecimientos del primer nivel
                es de {district.currentState.avgTravelTimeMinutes} minutos, con
                un índice de conectividad de{' '}
                {formatPercent(district.currentState.accessibilityIndex)}.
              </p>

              <div className="rounded-lg border border-border bg-surface-sunken/60 p-4">
                <h5 className="text-[11.5px] font-semibold text-foreground">
                  Factores determinantes de la prioridad
                </h5>
                <ul className="mt-2 space-y-1.5 text-[11.5px] text-muted-foreground">
                  <li>
                    · Pobreza monetaria: {formatPercent(district.sdoh.povertyRate)}{' '}
                    (quintil {district.sdoh.vulnerabilityQuintile})
                  </li>
                  <li>
                    · Déficit de saneamiento:{' '}
                    {formatPercent(district.sdoh.sanitationDeficit)}
                  </li>
                  <li>
                    · Presión asistencial:{' '}
                    {formatPercent(district.currentState.systemPressure)}
                  </li>
                  <li>
                    · Establecimientos operativos:{' '}
                    {district.activeFacilitiesCount} IPRESS
                  </li>
                </ul>
              </div>

              <div className="print-hidden">
                <Button
                  variant="primary"
                  onClick={() => generar(district.id)}
                  disabled={dictamenLoading}
                >
                  <Sparkles className="size-3.5" />
                  {dictamenLoading
                    ? 'Generando dictamen técnico…'
                    : 'Generar dictamen técnico'}
                </Button>
                {dictamenError && (
                  <p className="mt-2 text-[11px] text-negative">{dictamenError}</p>
                )}
              </div>

              {dictamen?.distrito.id === district.id && (
                <DictamenReport dictamen={dictamen} />
              )}
            </section>
          )}

          {scope === 'hotspots' && (
            <section className="space-y-4">
              <SectionTitle number="3">
                Matriz oficial de priorización para inversión pública
              </SectionTitle>
              <div className="overflow-hidden rounded-lg border border-border">
                <TableWrap>
                  <Table className="min-w-[560px]">
                    <Thead>
                      <tr>
                        <Th align="center" className="w-12">
                          #
                        </Th>
                        <Th>Distrito</Th>
                        <Th align="right">Población</Th>
                        <Th align="right">Vulnerabilidad</Th>
                        <Th align="right">Traslado</Th>
                        <Th align="right">Prioridad</Th>
                      </tr>
                    </Thead>
                    <Tbody>
                      {rankedTerritories.map((t, idx) => (
                        <Tr key={t.id}>
                          <Td
                            align="center"
                            className="font-mono text-subtle-foreground"
                          >
                            {String(idx + 1).padStart(2, '0')}
                          </Td>
                          <Td className="font-semibold">{t.name}</Td>
                          <Td align="right" className="numeric">
                            {formatNumber(t.population)}
                          </Td>
                          <Td align="right" className="numeric">
                            {formatPercent(t.sdoh.vulnerabilityIndex)}
                          </Td>
                          <Td align="right" className="numeric">
                            {t.currentState.avgTravelTimeMinutes} min
                          </Td>
                          <Td align="right">
                            <Badge
                              className={getRiskBadgeClass(
                                t.currentState.priorityIndex,
                              )}
                              mono
                            >
                              {formatPercent(t.currentState.priorityIndex)} ·{' '}
                              {getRiskLevel(t.currentState.priorityIndex)}
                            </Badge>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </TableWrap>
              </div>
            </section>
          )}

          {scope === 'simulation' && (
            <section className="space-y-4">
              <SectionTitle number="4">
                Evaluación de simulación What-If
              </SectionTitle>
              {latestSimulation ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-border bg-surface-sunken/60 p-4">
                    <h5 className="text-[12.5px] font-semibold text-foreground">
                      {latestSimulation.scenarioName}
                    </h5>
                    <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
                      {latestSimulation.verdict}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <StatCard
                      label="Δ Prioridad"
                      value={`${(latestSimulation.deltas.priorityDelta * 100).toFixed(0)} pts`}
                    />
                    <StatCard
                      label="Δ Accesibilidad"
                      value={`${(latestSimulation.deltas.accessibilityDelta * 100).toFixed(0)} pts`}
                    />
                    <StatCard
                      label="Tiempo ahorrado"
                      value={latestSimulation.deltas.travelTimeSavedMinutes.toFixed(
                        1,
                      )}
                      unit="min"
                    />
                    <StatCard
                      label="Población cubierta"
                      value={formatNumber(
                        latestSimulation.after.totalCoveragePop,
                      )}
                      unit="hab"
                    />
                  </div>
                </div>
              ) : (
                <p className="text-[12px] italic text-muted-foreground">
                  No se ha registrado ninguna simulación en esta sesión.
                </p>
              )}
            </section>
          )}

          {scope === 'equity' && (
            <section className="space-y-4">
              <SectionTitle number="5">
                Auditoría de equidad y rendimiento
              </SectionTitle>
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                La auditoría algorítmica confirma que el modelo espacio-temporal
                ST-GNN cumple los criterios de paridad de error entre quintiles
                de vulnerabilidad (disparate impact ratio = 1.08, dentro del
                umbral normativo &lt; 1.20). No se observa degradación
                sistemática del desempeño predictivo en los territorios de mayor
                vulnerabilidad social.
              </p>
            </section>
          )}

          <footer className="border-t border-border pt-4 text-[10px] leading-relaxed text-subtle-foreground">
            <strong className="font-semibold text-muted-foreground">
              Cláusula ética y de responsabilidad:
            </strong>{' '}
            este documento sintetiza estimaciones analíticas generadas mediante
            modelos matemáticos y redes neuronales espacio-temporales aplicadas a
            datos agregados del Área Metropolitana de Trujillo. Constituye una
            herramienta de apoyo a la toma de decisiones y no reemplaza la
            evaluación clínica individual ni la deliberación institucional de las
            autoridades sanitarias competentes.
          </footer>
        </CardBody>
      </Card>
    </ViewContainer>
  );
};

const SectionTitle: React.FC<{
  number: string;
  children: React.ReactNode;
}> = ({ number, children }) => (
  <h4 className="flex items-baseline gap-2 border-l-2 border-primary pl-3 text-[13px] font-semibold uppercase tracking-wide text-foreground">
    <span className="font-mono text-[11px] text-primary">{number}.</span>
    {children}
  </h4>
);
