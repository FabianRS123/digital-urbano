import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { Topbar } from '../components/layout/Topbar';
import { NavigationTab } from './navigation';
import { ThemeProvider } from './ThemeProvider';

import { ExecutiveDashboard } from '../features/overview/ExecutiveDashboard';
import { MapWorkspace } from '../features/map/MapWorkspace';
import { TerritoryDetail } from '../features/territories/TerritoryDetail';
import { FacilitiesCatalog } from '../features/facilities/FacilitiesCatalog';
import { PredictiveEngineView } from '../features/predictions/PredictiveEngineView';
import { HotspotsView } from '../features/hotspots/HotspotsView';
import { RiskExplainabilityView } from '../features/explainability/RiskExplainabilityView';
import { InterventionSimulator } from '../features/simulator/InterventionSimulator';
import { ScenarioComparisonView } from '../features/comparison/ScenarioComparisonView';
import { SavedScenariosView } from '../features/scenarios/SavedScenariosView';
import { EquityFairnessView } from '../features/equity/EquityFairnessView';
import { AIModelsBenchmarkView } from '../features/models/AIModelsBenchmarkView';
import { DataSourcesView } from '../features/datasources/DataSourcesView';
import { ReportsView } from '../features/reports/ReportsView';

import {
  AVAILABLE_MONTHS,
  INITIAL_DISTRICTS,
  INITIAL_FACILITIES,
} from '../data/trujilloData';
import { HealthFacility, SimulationResult, Territory } from '../types';
import { DigitalTwinEngine } from '../lib/simulationEngine';

/** Índice del mes base (Ago 2026) dentro de AVAILABLE_MONTHS. */
const BASE_MONTH_INDEX = AVAILABLE_MONTHS.findIndex(
  (m) => m.key === '2026-08',
);

function DigitalTwinApp() {
  const [currentTab, setCurrentTab] = useState<NavigationTab>('overview');
  const [navOpen, setNavOpen] = useState(false);
  const [selectedDistrictId, setSelectedDistrictId] = useState<number>(2);

  const [currentMonthIndex, setCurrentMonthIndex] =
    useState<number>(BASE_MONTH_INDEX);
  const [isPlayingTimeline, setIsPlayingTimeline] = useState(false);

  const [currentRole, setCurrentRole] = useState<string>('Investigador');

  const [territories, setTerritories] = useState<Territory[]>(INITIAL_DISTRICTS);
  const [facilities] = useState<HealthFacility[]>(INITIAL_FACILITIES);

  const [activeSimulationResult, setActiveSimulationResult] =
    useState<SimulationResult | null>(null);
  const [savedScenarios, setSavedScenarios] = useState<SimulationResult[]>([]);

  /* ---------------------------------------------------------------------- */
  /* Línea de base                                                          */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const baseline = DigitalTwinEngine.runSimulation(
      INITIAL_DISTRICTS,
      INITIAL_FACILITIES,
      {
        type: 'new_facility',
        targetDistrictId: 2,
        newFacilityName: 'Centro de Salud Materno Infantil Florencia Norte',
        newFacilityCategory: 'I-4',
        newFacilityCapacity: 2800,
      },
      'Línea de base: nueva IPRESS I-4 en El Porvenir',
      'Investigador Principal',
    );
    setActiveSimulationResult(baseline);
    setSavedScenarios([baseline]);
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Reproductor de la línea de tiempo                                      */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!isPlayingTimeline) return;

    const interval = window.setInterval(() => {
      setCurrentMonthIndex((prev) =>
        prev >= AVAILABLE_MONTHS.length - 1 ? prev : prev + 1,
      );
    }, 1400);

    return () => window.clearInterval(interval);
  }, [isPlayingTimeline]);

  // La detención al llegar al final vive en su propio efecto: llamar a
  // setState dentro de un updater es un efecto colateral prohibido en React.
  useEffect(() => {
    if (isPlayingTimeline && currentMonthIndex >= AVAILABLE_MONTHS.length - 1) {
      setIsPlayingTimeline(false);
    }
  }, [currentMonthIndex, isPlayingTimeline]);

  /* ---------------------------------------------------------------------- */
  /* Dinámica temporal del territorio                                       */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const month = AVAILABLE_MONTHS[currentMonthIndex];
    if (!month) return;

    const stepDiff = currentMonthIndex - BASE_MONTH_INDEX;
    const factor = 1 + stepDiff * 0.006;

    // Siempre se recalcula desde INITIAL_DISTRICTS para que el estado no
    // acumule deriva al navegar hacia atrás y hacia adelante en el tiempo.
    setTerritories(
      INITIAL_DISTRICTS.map((t) => {
        const adjustedDemand = Math.round(
          t.currentState.historicalDemand * factor,
        );
        const pressure =
          Math.round(
            (adjustedDemand / t.currentState.healthcareCapacity) * 100,
          ) / 100;
        const priority = DigitalTwinEngine.calculatePriorityIndex(
          t.sdoh.vulnerabilityIndex,
          pressure,
          t.currentState.accessibilityIndex,
          t.currentState.contagionRisk * 0.8,
        );

        return {
          ...t,
          currentState: {
            ...t.currentState,
            monthKey: month.key,
            historicalDemand: adjustedDemand,
            projectedDemand: Math.round(adjustedDemand * 1.03),
            systemPressure: pressure,
            priorityIndex: priority,
            hotspotCategory:
              priority >= 0.8
                ? 'Crítico'
                : priority >= 0.6
                  ? 'Alto'
                  : priority >= 0.4
                    ? 'Medio'
                    : 'Bajo',
          },
        };
      }),
    );
  }, [currentMonthIndex]);

  /* ---------------------------------------------------------------------- */
  /* Acciones                                                                */
  /* ---------------------------------------------------------------------- */

  const openSimulatorForDistrict = useCallback((districtId: number) => {
    setSelectedDistrictId(districtId);
    setCurrentTab('simulator');
  }, []);

  const openSimulatorForFacility = useCallback((facility: HealthFacility) => {
    setSelectedDistrictId(facility.districtId);
    setCurrentTab('simulator');
  }, []);

  const handleSimulationComplete = useCallback((result: SimulationResult) => {
    setActiveSimulationResult(result);
    setSavedScenarios((prev) => [
      result,
      ...prev.filter((s) => s.id !== result.id),
    ]);
  }, []);

  const handleDeleteScenario = useCallback((id: string) => {
    setSavedScenarios((prev) => prev.filter((s) => s.id !== id));
    setActiveSimulationResult((prev) => (prev?.id === id ? null : prev));
  }, []);

  const currentMonthLabel =
    AVAILABLE_MONTHS[currentMonthIndex]?.label ?? 'Ago 2026';

  const simulationOverlay = activeSimulationResult
    ? {
        targetDistrictId: activeSimulationResult.targetDistrict.id,
        beforePriority: activeSimulationResult.before.priorityIndex,
        afterPriority: activeSimulationResult.after.priorityIndex,
      }
    : null;

  return (
    <AppShell
      currentTab={currentTab}
      onSelectTab={setCurrentTab}
      savedScenariosCount={savedScenarios.length}
      navOpen={navOpen}
      onCloseNav={() => setNavOpen(false)}
      topbar={
        <Topbar
          currentMonthIndex={currentMonthIndex}
          onSelectMonthIndex={setCurrentMonthIndex}
          isPlayingTimeline={isPlayingTimeline}
          onTogglePlayTimeline={() => setIsPlayingTimeline((p) => !p)}
          onResetTimeline={() => {
            setCurrentMonthIndex(BASE_MONTH_INDEX);
            setIsPlayingTimeline(false);
          }}
          currentRole={currentRole}
          onSelectRole={setCurrentRole}
          onOpenSimulator={() => setCurrentTab('simulator')}
          onOpenNav={() => setNavOpen(true)}
        />
      }
    >
      {currentTab === 'overview' && (
        <ExecutiveDashboard
          territories={territories}
          facilities={facilities}
          selectedDistrictId={selectedDistrictId}
          onSelectDistrict={setSelectedDistrictId}
          onNavigateTab={setCurrentTab}
          currentMonthLabel={currentMonthLabel}
        />
      )}

      {currentTab === 'map' && (
        <MapWorkspace
          territories={territories}
          facilities={facilities}
          selectedDistrictId={selectedDistrictId}
          onSelectDistrict={setSelectedDistrictId}
          simulationOverlay={simulationOverlay}
          currentMonthLabel={currentMonthLabel}
        />
      )}

      {currentTab === 'territories' && (
        <TerritoryDetail
          territories={territories}
          selectedDistrictId={selectedDistrictId}
          facilities={facilities}
          onSelectDistrict={setSelectedDistrictId}
          onOpenSimulatorForDistrict={openSimulatorForDistrict}
        />
      )}

      {currentTab === 'facilities' && (
        <FacilitiesCatalog
          facilities={facilities}
          territories={territories}
          onSelectDistrict={setSelectedDistrictId}
          onOpenSimulatorForFacility={openSimulatorForFacility}
        />
      )}

      {currentTab === 'predictions' && (
        <PredictiveEngineView
          territories={territories}
          selectedDistrictId={selectedDistrictId}
          onSelectDistrict={setSelectedDistrictId}
        />
      )}

      {currentTab === 'hotspots' && (
        <HotspotsView
          territories={territories}
          onSelectDistrict={setSelectedDistrictId}
          onOpenSimulatorForDistrict={openSimulatorForDistrict}
        />
      )}

      {currentTab === 'explainability' && (
        <RiskExplainabilityView
          territories={territories}
          selectedDistrictId={selectedDistrictId}
          onSelectDistrict={setSelectedDistrictId}
        />
      )}

      {currentTab === 'simulator' && (
        <InterventionSimulator
          territories={territories}
          facilities={facilities}
          initialDistrictId={selectedDistrictId}
          onSimulationComplete={handleSimulationComplete}
          onNavigateToComparison={() => setCurrentTab('comparison')}
        />
      )}

      {currentTab === 'comparison' && (
        <ScenarioComparisonView
          simulationResult={activeSimulationResult}
          territories={territories}
          facilities={facilities}
          onOpenSimulator={() => setCurrentTab('simulator')}
        />
      )}

      {currentTab === 'history' && (
        <SavedScenariosView
          scenarios={savedScenarios}
          onSelectScenarioToCompare={(scenario) => {
            setActiveSimulationResult(scenario);
            setCurrentTab('comparison');
          }}
          onDeleteScenario={handleDeleteScenario}
          onOpenSimulator={() => setCurrentTab('simulator')}
        />
      )}

      {currentTab === 'equity' && <EquityFairnessView />}
      {currentTab === 'models' && <AIModelsBenchmarkView />}
      {currentTab === 'datasources' && <DataSourcesView />}

      {currentTab === 'reports' && (
        <ReportsView
          territories={territories}
          facilities={facilities}
          latestSimulation={activeSimulationResult}
        />
      )}
    </AppShell>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <DigitalTwinApp />
    </ThemeProvider>
  );
}
