import React from 'react';
import { ArrowRight, GitCompare, SlidersHorizontal } from 'lucide-react';
import { HealthFacility, SimulationResult, Territory } from '../../types';
import { MetropolitanMap } from '../../components/map/MetropolitanMap';
import { ViewContainer } from '../../components/layout/AppShell';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  Pill,
} from '../../components/ui';
import {
  formatDateTime,
  formatNumber,
  formatPercent,
  interventionLabel,
} from '../../lib/format';
import { deltaTone } from '../../lib/risk';
import { cn } from '../../lib/utils';

interface ScenarioComparisonViewProps {
  simulationResult: SimulationResult | null;
  territories: Territory[];
  facilities: HealthFacility[];
  onOpenSimulator: () => void;
}

export const ScenarioComparisonView: React.FC<ScenarioComparisonViewProps> = ({
  simulationResult,
  territories,
  facilities,
  onOpenSimulator,
}) => {
  if (!simulationResult) {
    return (
      <ViewContainer>
        <Card>
          <EmptyState
            icon={<GitCompare className="size-5" />}
            title="No hay ninguna simulación activa"
            description="Ejecuta un escenario What-If en el simulador para visualizar la comparación antes y después en el área metropolitana."
            action={
              <Button variant="primary" onClick={onOpenSimulator}>
                <SlidersHorizontal className="size-3.5" />
                Configurar simulación
              </Button>
            }
          />
        </Card>
      </ViewContainer>
    );
  }

  const { before, after, deltas, targetDistrict, scenarioName, affectedNeighbors } =
    simulationResult;

  const coverageDelta = after.totalCoveragePop - before.totalCoveragePop;

  const rows = [
    {
      label: 'Índice de prioridad',
      before: formatPercent(before.priorityIndex),
      after: formatPercent(after.priorityIndex),
      note: `${before.hotspotCategory} → ${after.hotspotCategory}`,
      delta: `${deltas.priorityDelta > 0 ? '+' : ''}${(deltas.priorityDelta * 100).toFixed(0)} pts`,
      tone: deltaTone(deltas.priorityDelta),
    },
    {
      label: 'Accesibilidad sanitaria',
      before: formatPercent(before.accessibilityIndex),
      after: formatPercent(after.accessibilityIndex),
      note: `${before.avgTravelTimeMinutes} min → ${after.avgTravelTimeMinutes} min`,
      delta: `${deltas.accessibilityDelta > 0 ? '+' : ''}${(deltas.accessibilityDelta * 100).toFixed(0)} pts`,
      tone: deltaTone(deltas.accessibilityDelta, false),
    },
    {
      label: 'Presión asistencial',
      before: formatPercent(before.systemPressure),
      after: formatPercent(after.systemPressure),
      note: 'Demanda sobre capacidad instalada',
      delta: `${deltas.pressureDelta > 0 ? '+' : ''}${(deltas.pressureDelta * 100).toFixed(0)} pts`,
      tone: deltaTone(deltas.pressureDelta),
    },
    {
      label: 'Población con cobertura',
      before: formatNumber(before.totalCoveragePop),
      after: formatNumber(after.totalCoveragePop),
      note: `de ${formatNumber(targetDistrict.population)} habitantes`,
      delta: `${coverageDelta > 0 ? '+' : ''}${formatNumber(coverageDelta)} hab`,
      tone: deltaTone(coverageDelta, false),
    },
  ];

  return (
    <ViewContainer>
      <PageHeader
        eyebrow="Simulación"
        title={scenarioName}
        description={`Distrito intervenido: ${targetDistrict.name} · ${interventionLabel(simulationResult.params.type)} · ${formatDateTime(simulationResult.createdAt)}`}
        actions={
          <Button onClick={onOpenSimulator}>
            <SlidersHorizontal className="size-3.5" />
            Modificar parámetros
          </Button>
        }
      />

      {/* Comparativa antes / después ------------------------------------- */}
      <Card flush>
        <CardHeader>
          <CardTitle hint="Cada fila contrasta la línea base con el escenario simulado">
            Contraste de indicadores
          </CardTitle>
          <Pill>{interventionLabel(simulationResult.params.type)}</Pill>
        </CardHeader>

        <div className="grid grid-cols-1 divide-y divide-border lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          {rows.map((row) => (
            <div key={row.label} className="p-5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {row.label}
                </span>
                <Badge
                  tone={
                    row.tone === 'positive'
                      ? 'positive'
                      : row.tone === 'negative'
                        ? 'negative'
                        : 'neutral'
                  }
                  mono
                >
                  {row.delta}
                </Badge>
              </div>

              <div className="mt-3 flex items-center gap-4">
                <div className="min-w-0">
                  <div className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-subtle-foreground">
                    Línea base
                  </div>
                  <div className="numeric mt-0.5 text-[22px] font-semibold leading-none tracking-tight text-muted-foreground">
                    {row.before}
                  </div>
                </div>

                <ArrowRight className="size-4 shrink-0 text-subtle-foreground" />

                <div className="min-w-0">
                  <div className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-primary">
                    Simulado
                  </div>
                  <div
                    className={cn(
                      'numeric mt-0.5 text-[22px] font-semibold leading-none tracking-tight',
                      row.tone === 'positive'
                        ? 'text-positive'
                        : row.tone === 'negative'
                          ? 'text-negative'
                          : 'text-foreground',
                    )}
                  >
                    {row.after}
                  </div>
                </div>
              </div>

              <p className="mt-2.5 text-[10.5px] text-muted-foreground">
                {row.note}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Territorio ------------------------------------------------------ */}
      <Card flush>
        <CardHeader>
          <CardTitle hint="El distrito intervenido se resalta con el valor posterior a la simulación">
            Visualización territorial del impacto
          </CardTitle>
        </CardHeader>
        <MetropolitanMap
          territories={territories}
          facilities={facilities}
          selectedDistrictId={targetDistrict.id}
          onSelectDistrict={() => {}}
          simulationOverlay={{
            targetDistrictId: targetDistrict.id,
            beforePriority: before.priorityIndex,
            afterPriority: after.priorityIndex,
          }}
          compact
          className="h-[440px] rounded-none border-0 border-t border-border"
        />
      </Card>

      {/* Vecinos --------------------------------------------------------- */}
      {affectedNeighbors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle hint="Transferencia de demanda estimada por el grafo metropolitano">
              Impacto en distritos vecinos
            </CardTitle>
          </CardHeader>
          <CardBody className="grid grid-cols-1 gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-3">
            {affectedNeighbors.map((neighbor) => (
              <div
                key={neighbor.districtId}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-sunken/60 px-3.5 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-semibold text-foreground">
                    {neighbor.districtName}
                  </div>
                  <div className="numeric mt-0.5 text-[10px] text-muted-foreground">
                    Nueva prioridad {formatPercent(neighbor.priorityAfter)}
                  </div>
                </div>
                <span
                  className={cn(
                    'numeric shrink-0 font-mono text-[12px] font-semibold',
                    neighbor.pressureDeltaPct < 0
                      ? 'text-positive'
                      : 'text-negative',
                  )}
                >
                  {neighbor.pressureDeltaPct > 0 ? '+' : ''}
                  {neighbor.pressureDeltaPct.toFixed(1)} %
                </span>
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </ViewContainer>
  );
};
