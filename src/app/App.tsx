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

import { HealthFacility, SimulationResult, Territory, AIModelBenchmark, EquityMetric, DataSourceItem } from '../types';
import { monthLabel } from '../lib/officialModel';

interface Bootstrap {
  version: string; createdAt: string; checkedAt: string; month: string; months: string[]; territories: Territory[];
  facilities: HealthFacility[]; sources: DataSourceItem[]; warnings: string[];
  benchmarks: AIModelBenchmark[]; equity: EquityMetric[];
}

function DigitalTwinApp() {
  const [currentTab, setCurrentTab] = useState<NavigationTab>('overview');
  const [navOpen, setNavOpen] = useState(false);
  const [selectedDistrictId, setSelectedDistrictId] = useState<number>(2);

  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);
  const [isPlayingTimeline, setIsPlayingTimeline] = useState(false);

  const [currentRole, setCurrentRole] = useState<string>('Investigador');

  const [data, setData] = useState<Bootstrap | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const months = data?.months ?? [];
  const territories = data?.territories ?? [];
  const facilities = data?.facilities ?? [];

  const [activeSimulationResult, setActiveSimulationResult] =
    useState<SimulationResult | null>(null);
  const [savedScenarios, setSavedScenarios] = useState<SimulationResult[]>([]);

  /* ---------------------------------------------------------------------- */
  /* Datos oficiales                                                         */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/v1/bootstrap');
        if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
        const payload = await res.json() as Bootstrap;
        if (!cancelled) { setData(payload); setCurrentMonthIndex(payload.months.indexOf(payload.month)); setLoadError(null); }
      } catch (error) { if (!cancelled) { setLoadError(String(error)); window.setTimeout(load, 5000); } }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!data || !months[currentMonthIndex] || months[currentMonthIndex] === data.month) return;
    const controller = new AbortController();
    void fetch(`/api/v1/bootstrap?month=${months[currentMonthIndex]}`, { signal: controller.signal })
      .then(async (res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json() as Promise<Bootstrap>; })
      .then((payload) => { setData(payload); setActiveSimulationResult(null); })
      .catch((error) => { if (error.name !== 'AbortError') setLoadError(String(error)); });
    return () => controller.abort();
  }, [currentMonthIndex, months.join(','), data?.version]);

  /* ---------------------------------------------------------------------- */
  /* Reproductor de la línea de tiempo                                      */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!isPlayingTimeline) return;

    const interval = window.setInterval(() => {
      setCurrentMonthIndex((prev) =>
        prev >= months.length - 1 ? prev : prev + 1,
      );
    }, 1400);

    return () => window.clearInterval(interval);
  }, [isPlayingTimeline, months.length]);

  // La detención al llegar al final vive en su propio efecto: llamar a
  // setState dentro de un updater es un efecto colateral prohibido en React.
  useEffect(() => {
    if (isPlayingTimeline && currentMonthIndex >= months.length - 1) {
      setIsPlayingTimeline(false);
    }
  }, [currentMonthIndex, isPlayingTimeline, months.length]);

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
    months[currentMonthIndex] ? monthLabel(months[currentMonthIndex]) : 'Cargando';

  const simulationOverlay = activeSimulationResult
    ? {
        targetDistrictId: activeSimulationResult.targetDistrict.id,
        beforePriority: activeSimulationResult.before.priorityIndex,
        afterPriority: activeSimulationResult.after.priorityIndex,
      }
    : null;

  if (!data) return <div className="p-8 text-sm text-foreground">{loadError ?? 'Cargando datos oficiales…'}<p className="mt-2 text-muted-foreground">Si es la primera ejecución, el servidor está preparando los archivos SIS.</p></div>;

  return (
    <AppShell
      currentTab={currentTab}
      onSelectTab={setCurrentTab}
      savedScenariosCount={savedScenarios.length}
      navOpen={navOpen}
      onCloseNav={() => setNavOpen(false)}
      topbar={
        <Topbar
          months={months.map((key) => ({ key, label: monthLabel(key), isProjected: false }))}
          currentMonthIndex={currentMonthIndex}
          onSelectMonthIndex={setCurrentMonthIndex}
          isPlayingTimeline={isPlayingTimeline}
          onTogglePlayTimeline={() => setIsPlayingTimeline((p) => !p)}
          onResetTimeline={() => {
            setCurrentMonthIndex(months.length - 1);
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
          months={months}
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
          datasetVersion={data.version}
          sources={data.sources}
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
          datasetVersion={data.version}
          monthKey={data.month}
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

      {currentTab === 'equity' && <EquityFairnessView metrics={data.equity} />}
      {currentTab === 'models' && <AIModelsBenchmarkView models={data.benchmarks} />}
      {currentTab === 'datasources' && <DataSourcesView sources={data.sources} version={data.version} createdAt={data.createdAt} checkedAt={data.checkedAt} onUpdated={async () => {
        const res = await fetch('/api/v1/bootstrap'); if (res.ok) { const next = await res.json() as Bootstrap;
          setData(next); setCurrentMonthIndex(next.months.indexOf(next.month));
          setActiveSimulationResult(null); setSavedScenarios([]); }
      }} />}

      {currentTab === 'reports' && (
        <ReportsView
          territories={territories}
          facilities={facilities}
          latestSimulation={activeSimulationResult}
          sources={data.sources}
          datasetVersion={data.version}
          monthKey={data.month}
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
