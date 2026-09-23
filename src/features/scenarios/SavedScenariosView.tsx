import React from 'react';
import { GitCompare, History, SlidersHorizontal, Trash2 } from 'lucide-react';
import { SimulationResult } from '../../types';
import { ViewContainer } from '../../components/layout/AppShell';
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  PageHeader,
  Pill,
} from '../../components/ui';
import {
  formatDate,
  formatPercent,
  interventionLabel,
} from '../../lib/format';
import { deltaTone } from '../../lib/risk';

interface SavedScenariosViewProps {
  scenarios: SimulationResult[];
  onSelectScenarioToCompare: (scenario: SimulationResult) => void;
  onDeleteScenario: (id: string) => void;
  onOpenSimulator: () => void;
}

export const SavedScenariosView: React.FC<SavedScenariosViewProps> = ({
  scenarios,
  onSelectScenarioToCompare,
  onDeleteScenario,
  onOpenSimulator,
}) => (
  <ViewContainer>
    <PageHeader
      eyebrow="Simulación"
      title="Escenarios contrafácticos guardados"
      description="Registro de simulaciones de la sesión para análisis comparativo y respaldo de decisiones públicas."
      actions={
        <Button variant="primary" onClick={onOpenSimulator}>
          <SlidersHorizontal className="size-3.5" />
          Nueva simulación
        </Button>
      }
    />

    {scenarios.length === 0 ? (
      <Card>
        <EmptyState
          icon={<History className="size-5" />}
          title="Todavía no hay escenarios guardados"
          description="Crea una simulación en el motor What-If y guárdala para conservarla en el historial de investigación."
          action={
            <Button variant="primary" onClick={onOpenSimulator}>
              Ir al simulador
            </Button>
          }
        />
      </Card>
    ) : (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {scenarios.map((scenario) => {
          const tone = deltaTone(scenario.deltas.priorityDelta);
          return (
            <Card key={scenario.id} className="flex flex-col">
              <CardBody className="flex flex-1 flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Pill>{interventionLabel(scenario.params.type)}</Pill>
                      <Pill>{scenario.targetDistrict.name}</Pill>
                    </div>
                    <h3 className="mt-1.5 text-[13px] font-semibold leading-snug text-foreground">
                      {scenario.scenarioName}
                    </h3>
                    {scenario.monthKey && <p className="text-[10px] text-muted-foreground">SIS {scenario.monthKey} · versión {scenario.datasetVersion}</p>}
                  </div>
                  <Badge
                    tone={
                      tone === 'positive'
                        ? 'positive'
                        : tone === 'negative'
                          ? 'negative'
                          : 'neutral'
                    }
                    mono
                  >
                    Δ {(scenario.deltas.priorityDelta * 100).toFixed(0)} pts
                  </Badge>
                </div>

                <p className="line-clamp-3 text-[11.5px] leading-relaxed text-muted-foreground">
                  {scenario.verdict}
                </p>

                <dl className="mt-auto grid grid-cols-3 gap-2 border-t border-border pt-3 text-[10.5px]">
                  <div>
                    <dt className="text-subtle-foreground">Accesibilidad</dt>
                    <dd className="numeric mt-0.5 font-semibold text-foreground">
                      {formatPercent(scenario.after.accessibilityIndex)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-subtle-foreground">Tiempo de viaje</dt>
                    <dd className="numeric mt-0.5 font-semibold text-foreground">
                      {scenario.after.avgTravelTimeMinutes} min
                    </dd>
                  </div>
                  <div>
                    <dt className="text-subtle-foreground">Presión</dt>
                    <dd className="numeric mt-0.5 font-semibold text-foreground">
                      {formatPercent(scenario.after.systemPressure)}
                    </dd>
                  </div>
                </dl>

                <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                  <span className="text-[10px] text-subtle-foreground">
                    {formatDate(scenario.createdAt)} · {scenario.authorRole}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      onClick={() => onSelectScenarioToCompare(scenario)}
                    >
                      <GitCompare className="size-3.5" />
                      Comparar
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onDeleteScenario(scenario.id)}
                      title="Eliminar escenario"
                      aria-label={`Eliminar ${scenario.scenarioName}`}
                      className="hover:text-negative"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>
    )}
  </ViewContainer>
);
