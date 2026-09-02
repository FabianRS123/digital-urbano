import React, { useEffect, useState } from 'react';
import {
  AlertOctagon,
  Check,
  Clock3,
  GitCompare,
  Navigation,
  PlusCircle,
  Save,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import {
  HealthFacility,
  InterventionParams,
  InterventionType,
  SimulationResult,
  Territory,
} from '../../types';
import { DigitalTwinEngine } from '../../lib/simulationEngine';
import { ViewContainer } from '../../components/layout/AppShell';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Callout,
  EmptyState,
  FieldLabel,
  Input,
  PageHeader,
  Select,
  Slider,
  StatCard,
} from '../../components/ui';
import { formatNumber, formatPercent } from '../../lib/format';
import { deltaTone } from '../../lib/risk';
import { cn } from '../../lib/utils';

interface InterventionSimulatorProps {
  territories: Territory[];
  facilities: HealthFacility[];
  initialDistrictId?: number;
  onSimulationComplete: (result: SimulationResult) => void;
  onNavigateToComparison: () => void;
}

const INTERVENTIONS: {
  id: InterventionType;
  label: string;
  hint: string;
  icon: React.ElementType;
  destructive?: boolean;
}[] = [
  {
    id: 'new_facility',
    label: 'Nueva IPRESS',
    hint: 'Primer nivel o centro materno',
    icon: PlusCircle,
  },
  {
    id: 'expand_capacity',
    label: 'Ampliar capacidad',
    hint: 'Horarios y consultorios',
    icon: Clock3,
  },
  {
    id: 'improve_access',
    label: 'Red vial y transporte',
    hint: 'Reducción de tiempos de viaje',
    icon: Navigation,
  },
  {
    id: 'temporary_closure',
    label: 'Cierre o contingencia',
    hint: 'Simulación de estrés del sistema',
    icon: AlertOctagon,
    destructive: true,
  },
];

export const InterventionSimulator: React.FC<InterventionSimulatorProps> = ({
  territories,
  facilities,
  initialDistrictId,
  onSimulationComplete,
  onNavigateToComparison,
}) => {
  const [targetDistrictId, setTargetDistrictId] = useState<number>(
    initialDistrictId ?? territories[1]?.id ?? territories[0].id,
  );
  const [interventionType, setInterventionType] =
    useState<InterventionType>('new_facility');
  const [scenarioName, setScenarioName] = useState('');

  const [newFacilityName, setNewFacilityName] = useState(
    'Puesto de Salud Alto Trujillo II',
  );
  const [newFacilityCategory, setNewFacilityCategory] = useState('I-3');
  const [newFacilityCapacity, setNewFacilityCapacity] = useState(2500);
  const [capacityIncreasePct, setCapacityIncreasePct] = useState(35);
  const [travelTimeReductionPct, setTravelTimeReductionPct] = useState(25);
  // Los identificadores de IPRESS son cadenas ("fac-12"); usarlos como número
  // rompía la selección del establecimiento en contingencia.
  const [closureFacilityId, setClosureFacilityId] = useState<string>('');

  const [result, setResult] = useState<SimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle',
  );

  const targetDistrict =
    territories.find((t) => t.id === targetDistrictId) ?? territories[0];
  const districtFacilities = facilities.filter(
    (f) => f.districtId === targetDistrict.id,
  );

  // Sugerencia de nombre siempre coherente con distrito e intervención.
  useEffect(() => {
    const label = INTERVENTIONS.find((i) => i.id === interventionType)?.label;
    setScenarioName(`${label} en ${targetDistrict.name}`);
  }, [interventionType, targetDistrict.name]);

  // El establecimiento elegido debe pertenecer al distrito activo.
  useEffect(() => {
    if (
      closureFacilityId &&
      !districtFacilities.some((f) => f.id === closureFacilityId)
    ) {
      setClosureFacilityId('');
    }
  }, [closureFacilityId, districtFacilities]);

  const handleRunSimulation = () => {
    setIsSimulating(true);
    setSaveState('idle');

    const params: InterventionParams = {
      type: interventionType,
      targetDistrictId,
      newFacilityName:
        interventionType === 'new_facility' ? newFacilityName : undefined,
      newFacilityCategory:
        interventionType === 'new_facility' ? newFacilityCategory : undefined,
      newFacilityCapacity:
        interventionType === 'new_facility' ? newFacilityCapacity : undefined,
      capacityIncreasePct:
        interventionType === 'expand_capacity' ? capacityIncreasePct : undefined,
      travelTimeReductionPct:
        interventionType === 'improve_access'
          ? travelTimeReductionPct
          : undefined,
      targetFacilityId:
        interventionType === 'temporary_closure' && closureFacilityId
          ? closureFacilityId
          : undefined,
    };

    window.setTimeout(() => {
      const simulation = DigitalTwinEngine.runSimulation(
        territories,
        facilities,
        params,
        scenarioName,
        'Investigador Principal',
      );
      setResult(simulation);
      setIsSimulating(false);
      onSimulationComplete(simulation);
    }, 260);
  };

  const handleSaveToBackend = async () => {
    if (!result) return;
    setSaveState('saving');
    try {
      const res = await fetch('/api/v1/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioName,
          params: result.params,
          authorRole: 'Investigador Principal',
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaveState('saved');
    } catch (error) {
      console.error(error);
      setSaveState('error');
    } finally {
      window.setTimeout(() => setSaveState('idle'), 3500);
    }
  };

  return (
    <ViewContainer>
      <PageHeader
        eyebrow="Simulación"
        title="Simulador de intervenciones What-If"
        description="Experimenta escenarios contrafácticos de infraestructura, ampliación y accesibilidad antes de la toma de decisiones."
        actions={
          result && (
            <Button onClick={onNavigateToComparison}>
              <GitCompare className="size-3.5" />
              Ver comparador
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Configuración ------------------------------------------------ */}
        <Card className="xl:col-span-5">
          <CardHeader>
            <CardTitle icon={<SlidersHorizontal className="size-4" />}>
              Configuración de la intervención
            </CardTitle>
            <Badge tone="outline" mono>
              Paso 1 de 2
            </Badge>
          </CardHeader>

          <CardBody className="space-y-5 pt-4">
            <div className="space-y-1.5">
              <FieldLabel htmlFor="scenario-name">
                Nombre del escenario
              </FieldLabel>
              <Input
                id="scenario-name"
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                placeholder="Ej. Plan de choque en El Porvenir"
              />
            </div>

            <div className="space-y-1.5">
              <FieldLabel htmlFor="target-district">Distrito objetivo</FieldLabel>
              <Select
                id="target-district"
                value={targetDistrictId}
                onChange={(e) =>
                  setTargetDistrictId(parseInt(e.target.value, 10))
                }
              >
                {territories.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · prioridad{' '}
                    {formatPercent(t.currentState.priorityIndex)}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <FieldLabel>Tipo de intervención</FieldLabel>
              <div className="grid grid-cols-2 gap-2">
                {INTERVENTIONS.map((option) => {
                  const Icon = option.icon;
                  const active = interventionType === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setInterventionType(option.id)}
                      aria-pressed={active}
                      className={cn(
                        'cursor-pointer rounded-lg border p-3 text-left transition-colors',
                        active
                          ? option.destructive
                            ? 'border-negative bg-negative/[0.08] ring-1 ring-negative/25'
                            : 'border-primary bg-primary/[0.08] ring-1 ring-primary/25'
                          : 'border-border bg-surface hover:border-border-strong hover:bg-muted/60',
                      )}
                    >
                      <Icon
                        className={cn(
                          'mb-1.5 size-4',
                          active
                            ? option.destructive
                              ? 'text-negative'
                              : 'text-primary'
                            : 'text-muted-foreground',
                        )}
                      />
                      <div className="text-[12px] font-semibold text-foreground">
                        {option.label}
                      </div>
                      <div className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                        {option.hint}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Parámetros condicionales -------------------------------- */}
            <div className="rounded-lg border border-border bg-surface-sunken/70 p-4">
              {interventionType === 'new_facility' && (
                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="facility-name">
                      Nombre del establecimiento
                    </FieldLabel>
                    <Input
                      id="facility-name"
                      value={newFacilityName}
                      onChange={(e) => setNewFacilityName(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <FieldLabel htmlFor="facility-cat">Categoría</FieldLabel>
                      <Select
                        id="facility-cat"
                        value={newFacilityCategory}
                        onChange={(e) => setNewFacilityCategory(e.target.value)}
                      >
                        <option value="I-2">I-2 · Puesto con médico</option>
                        <option value="I-3">I-3 · Centro de salud</option>
                        <option value="I-4">I-4 · Centro materno infantil</option>
                        <option value="II-1">II-1 · Hospital general</option>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel htmlFor="facility-cap">
                        Capacidad mensual
                      </FieldLabel>
                      <Input
                        id="facility-cap"
                        type="number"
                        min={200}
                        step={100}
                        value={newFacilityCapacity}
                        onChange={(e) =>
                          setNewFacilityCapacity(
                            Math.max(parseInt(e.target.value, 10) || 0, 0),
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              )}

              {interventionType === 'expand_capacity' && (
                <Slider
                  label="Incremento de capacidad asistencial"
                  value={capacityIncreasePct}
                  displayValue={`+${capacityIncreasePct} %`}
                  min={10}
                  max={80}
                  step={5}
                  onChange={setCapacityIncreasePct}
                  hint={`Añade ${formatNumber(
                    Math.round(
                      targetDistrict.currentState.healthcareCapacity *
                        (capacityIncreasePct / 100),
                    ),
                  )} consultas mensuales a ${targetDistrict.name}.`}
                />
              )}

              {interventionType === 'improve_access' && (
                <Slider
                  label="Reducción del tiempo de traslado"
                  value={travelTimeReductionPct}
                  displayValue={`−${travelTimeReductionPct} %`}
                  min={10}
                  max={50}
                  step={5}
                  onChange={setTravelTimeReductionPct}
                  hint={`El tiempo medio pasa de ${targetDistrict.currentState.avgTravelTimeMinutes} min a ${(
                    targetDistrict.currentState.avgTravelTimeMinutes *
                    (1 - travelTimeReductionPct / 100)
                  ).toFixed(1)} min.`}
                />
              )}

              {interventionType === 'temporary_closure' && (
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="closure-facility">
                    Establecimiento en contingencia
                  </FieldLabel>
                  <Select
                    id="closure-facility"
                    value={closureFacilityId}
                    onChange={(e) => setClosureFacilityId(e.target.value)}
                  >
                    <option value="">
                      Contingencia general (40 % de la capacidad distrital)
                    </option>
                    {districtFacilities.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} · Cat. {f.category} ·{' '}
                        {formatNumber(f.monthlyCapacity)}/mes
                      </option>
                    ))}
                  </Select>
                  <p className="text-[10.5px] leading-relaxed text-muted-foreground">
                    Simula el estrés del sistema al retirar oferta local y
                    desplazar demanda hacia los distritos colindantes.
                  </p>
                </div>
              )}
            </div>

            <Button
              variant="primary"
              onClick={handleRunSimulation}
              disabled={isSimulating}
              className="w-full justify-center"
            >
              {isSimulating
                ? 'Calculando gemelo digital…'
                : 'Ejecutar simulación What-If'}
            </Button>
          </CardBody>
        </Card>

        {/* Resultado ----------------------------------------------------- */}
        <Card className="xl:col-span-7">
          <CardHeader>
            <CardTitle icon={<Sparkles className="size-4" />}>
              Impacto contrafáctico
            </CardTitle>
            {result && (
              <Badge tone="positive" mono>
                Calculado
              </Badge>
            )}
          </CardHeader>

          {!result ? (
            <EmptyState
              icon={<SlidersHorizontal className="size-5" />}
              title="Aún no has ejecutado una simulación"
              description="Configura los parámetros a la izquierda y ejecuta el escenario. El motor espacio-temporal evaluará la ganancia en accesibilidad, la descongestión y el efecto sobre los distritos colindantes."
            />
          ) : (
            <CardBody className="animate-fade-rise space-y-4 pt-4">
              <Callout
                icon={<Check className="size-4" />}
                title="Dictamen del escenario"
                tone="info"
              >
                {result.verdict}
              </Callout>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard
                  label="Prioridad sanitaria"
                  value={formatPercent(result.after.priorityIndex)}
                  delta={`${result.deltas.priorityDelta > 0 ? '+' : ''}${(
                    result.deltas.priorityDelta * 100
                  ).toFixed(0)} pts`}
                  deltaTone={deltaTone(result.deltas.priorityDelta)}
                  hint={result.after.hotspotCategory}
                />
                <StatCard
                  label="Accesibilidad"
                  value={formatPercent(result.after.accessibilityIndex)}
                  delta={`${result.deltas.accessibilityDelta > 0 ? '+' : ''}${(
                    result.deltas.accessibilityDelta * 100
                  ).toFixed(0)} pts`}
                  deltaTone={deltaTone(result.deltas.accessibilityDelta, false)}
                  hint={`antes ${formatPercent(result.before.accessibilityIndex)}`}
                />
                <StatCard
                  label="Tiempo de viaje"
                  value={result.after.avgTravelTimeMinutes}
                  unit="min"
                  delta={`${
                    result.deltas.travelTimeSavedMinutes > 0 ? '−' : '+'
                  }${Math.abs(result.deltas.travelTimeSavedMinutes).toFixed(1)} min`}
                  deltaTone={deltaTone(-result.deltas.travelTimeSavedMinutes)}
                  hint={`antes ${result.before.avgTravelTimeMinutes} min`}
                />
                <StatCard
                  label="Presión asistencial"
                  value={formatPercent(result.after.systemPressure)}
                  delta={`${result.deltas.pressureDelta > 0 ? '+' : ''}${(
                    result.deltas.pressureDelta * 100
                  ).toFixed(0)} pts`}
                  deltaTone={deltaTone(result.deltas.pressureDelta)}
                  hint={`antes ${formatPercent(result.before.systemPressure)}`}
                />
              </div>

              {result.affectedNeighbors.length > 0 && (
                <div className="rounded-lg border border-border bg-surface-sunken/70 p-4">
                  <h4 className="text-[11.5px] font-semibold text-foreground">
                    Efecto en distritos limítrofes (grafo GNN)
                  </h4>
                  <ul className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {result.affectedNeighbors.map((neighbor) => (
                      <li
                        key={neighbor.districtId}
                        className="flex items-center justify-between gap-3 rounded-md bg-surface px-3 py-2"
                      >
                        <span className="truncate text-[11.5px] font-medium text-foreground">
                          {neighbor.districtName}
                        </span>
                        <span
                          className={cn(
                            'numeric shrink-0 font-mono text-[11px] font-semibold',
                            neighbor.pressureDeltaPct < 0
                              ? 'text-positive'
                              : 'text-negative',
                          )}
                        >
                          {neighbor.pressureDeltaPct > 0 ? '+' : ''}
                          {neighbor.pressureDeltaPct.toFixed(1)} % presión
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
                <Button
                  onClick={handleSaveToBackend}
                  disabled={saveState === 'saving'}
                  variant={saveState === 'saved' ? 'primary' : 'secondary'}
                >
                  {saveState === 'saved' ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Save className="size-3.5" />
                  )}
                  {saveState === 'saving'
                    ? 'Guardando…'
                    : saveState === 'saved'
                      ? 'Escenario guardado'
                      : saveState === 'error'
                        ? 'Guardado local (sin backend)'
                        : 'Guardar escenario'}
                </Button>

                <Button variant="primary" onClick={onNavigateToComparison}>
                  <GitCompare className="size-3.5" />
                  Ir a la vista comparativa
                </Button>
              </div>
            </CardBody>
          )}
        </Card>
      </div>
    </ViewContainer>
  );
};
