// Carga .env / .env.local antes de leer cualquier process.env. Sin esto, las
// claves colocadas en un archivo se ignoraban y solo servían las variables de
// entorno del sistema.
import 'dotenv/config';
import express from 'express';
import path from 'path';
import { construirDictamenBase, narrativaPorReglas } from './src/lib/dictamen';
import type { DictamenTecnico } from './src/types';

// Servicio de agente (FastAPI + LangChain). Es opcional: si no está levantado,
// el dictamen se completa con la narrativa por reglas.
const AGENT_URL = process.env.AGENT_URL ?? 'http://127.0.0.1:8000/api/v1';
import { RISK_THRESHOLDS } from './src/lib/riskThresholds';
import { buildOfficialSnapshot, readOfficialSnapshot, saveOfficialSnapshot } from './src/data/realData';
import type { RealSnapshot } from './src/data/realData';
import { buildModelView } from './src/lib/officialModel';
import { DigitalTwinEngine } from './src/lib/simulationEngine';
import { generateDistrictTimeSeries, getRiskFactorsExplanation } from './src/lib/spatiotemporalGnn';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  let snapshot: RealSnapshot | null = readOfficialSnapshot();
  const currentView = (month?: string) => {
    if (!snapshot) throw new Error('Datos oficiales no disponibles. Ejecuta pnpm data:sync.');
    return buildModelView(snapshot, month);
  };
  let syncState: { status: 'idle' | 'running' | 'success' | 'error'; progress: string; error?: string } =
    { status: 'idle', progress: '' };
  const startSync = () => {
    if (syncState.status === 'running') return false;
    syncState = { status: 'running', progress: 'Iniciando descarga' };
    void buildOfficialSnapshot((progress) => { syncState.progress = progress; })
      .then(async (next) => {
        const unchanged = snapshot?.version === next.version;
        const published = unchanged ? { ...next, createdAt: snapshot!.createdAt } : next;
        await saveOfficialSnapshot(published); snapshot = published;
        syncState = { status: 'success', progress: unchanged ? `Sin cambios; versión ${next.version} validada` : `Versión ${next.version} actualizada` };
      })
      .catch((error) => { console.error('Sincronización oficial:', error);
        syncState = { status: 'error', progress: 'Se conserva la última copia válida', error: String(error) }; });
    return true;
  };
  if (!snapshot || Date.now() - Date.parse(snapshot.checkedAt) > 24 * 60 * 60 * 1000) startSync();
  let savedSimulations: any[] = [];

  app.get('/api/v1/bootstrap', (req, res) => {
    try { res.json(currentView(req.query.month as string | undefined)); }
    catch (error) { res.status(503).json({ error: String(error), syncState }); }
  });
  app.get('/api/v1/data-sources/sync', (_req, res) => res.json(syncState));
  app.post('/api/v1/data-sources/sync', (_req, res) => {
    if (!startSync()) return res.status(409).json(syncState);
    res.status(202).json(syncState);
  });
  app.use('/api/v1', (req, res, next) => {
    if (!snapshot) return res.status(503).json({ error: 'Sin copia oficial. Ejecuta pnpm data:sync.', syncState });
    const requestedMonth = req.method === 'GET' ? req.query.month : req.body?.monthKey;
    if (requestedMonth && !snapshot.months.includes(String(requestedMonth)))
      return res.status(400).json({ error: `Mes sin atenciones SIS: ${requestedMonth}` });
    if (req.method === 'POST' && ['simulate', 'ai-analysis', 'langflow/recomendacion'].includes(req.path.slice(1)) &&
      !req.body?.datasetVersion) return res.status(400).json({ error: 'Falta datasetVersion. Recarga los datos antes de calcular.' });
    if (req.method === 'POST' && ['simulate', 'ai-analysis', 'langflow/recomendacion'].includes(req.path.slice(1)) &&
      req.body.datasetVersion !== snapshot.version)
      return res.status(409).json({ error: 'Versión de datos cambiada. Recarga antes de calcular.', version: snapshot.version });
    res.setHeader('X-Dataset-Version', snapshot.version);
    res.setHeader('X-Dataset-Month', String(requestedMonth ?? snapshot.months.at(-1)));
    next();
  });

  // ================= REST API ROUTERS (/api/v1/...) =================

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Gemelo Digital Urbano de Salud - Trujillo API',
      version: '1.0.0-academic',
      timestamp: new Date().toISOString()
    });
  });

  // 1. Territories / Distritos
  app.get('/api/v1/territories', (req, res) => {
    const currentTerritories = currentView(req.query.month as string | undefined).territories;
    res.json({
      count: currentTerritories.length,
      data: currentTerritories
    });
  });

  app.get('/api/v1/territories/:id', (req, res) => {
    const view = currentView(req.query.month as string | undefined);
    const currentTerritories = view.territories, currentFacilities = view.facilities;
    const id = parseInt(req.params.id, 10);
    const territory = currentTerritories.find((t: any) => t.id === id);
    if (!territory) {
      return res.status(404).json({ error: 'Territorio no encontrado' });
    }
    const facilities = currentFacilities.filter((f: any) => f.districtId === id);
    const timeSeries = generateDistrictTimeSeries(territory, 6);
    const explanations = getRiskFactorsExplanation(territory);

    res.json({
      territory,
      facilities,
      timeSeries,
      explanations
    });
  });

  // 2. Health Facilities (IPRESS)
  app.get('/api/v1/facilities', (req, res) => {
    const currentFacilities = currentView(req.query.month as string | undefined).facilities;
    const { districtId, category, status } = req.query;
    let results = [...currentFacilities];

    if (districtId) {
      results = results.filter(f => f.districtId === parseInt(districtId as string, 10));
    }
    if (category) {
      results = results.filter(f => f.category === category);
    }
    if (status) {
      results = results.filter(f => f.operationalStatus === status);
    }

    res.json({
      total: results.length,
      data: results
    });
  });

  // 3. Hotspots Ranking & Thresholds
  app.get('/api/v1/hotspots', (req, res) => {
    const currentTerritories = currentView(req.query.month as string | undefined).territories;
    const sorted = [...currentTerritories].sort(
      (a: any, b: any) => (b.currentState.priorityIndex ?? -1) - (a.currentState.priorityIndex ?? -1)
    );
    res.json({
      thresholds: RISK_THRESHOLDS,
      hotspots: sorted
    });
  });

  // 4. Predictions / Time Series
  app.get('/api/v1/predictions/:districtId', (req, res) => {
    const currentTerritories = currentView(req.query.month as string | undefined).territories;
    const id = parseInt(req.params.districtId, 10);
    const territory = currentTerritories.find((t: any) => t.id === id);
    if (!territory) {
      return res.status(404).json({ error: 'Territorio no encontrado' });
    }
    const horizon = parseInt((req.query.horizon as string) || '6', 10);
    const points = generateDistrictTimeSeries(territory, horizon);
    res.json({
      districtId: id,
      districtName: territory.name,
      horizonMonths: horizon,
      modelName: 'Persistencia estacional',
      modelVersion: '1',
      forecast: points
    });
  });

  // 5. Intervention Simulator (What-if Engine)
  app.post('/api/v1/simulate', (req, res) => {
    try {
      const view = currentView(req.body.monthKey);
      const currentTerritories = view.territories, currentFacilities = view.facilities;
      const { params, scenarioName, authorRole } = req.body;
      if (!params || !params.targetDistrictId) {
        return res.status(400).json({ error: 'Parámetros de intervención incompletos' });
      }
      const target = currentTerritories.find((t) => t.id === params.targetDistrictId);
      if (!target || target.currentState.healthcareCapacity === null || target.currentState.priorityIndex === null)
        return res.status(422).json({ error: 'Este distrito no tiene capacidad SIS estimable para simular.' });

      const result = DigitalTwinEngine.runSimulation(
        currentTerritories,
        currentFacilities,
        params,
        scenarioName || 'Escenario Simulado',
        authorRole || 'Investigador Principal'
      );

      savedSimulations.unshift({ ...result, datasetVersion: view.version, monthKey: view.month });
      if (savedSimulations.length > 50) savedSimulations.pop();

      res.json({
        status: 'success',
        result: { ...result, datasetVersion: view.version, monthKey: view.month }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error en el motor de simulación' });
    }
  });

  // 6. Saved Scenarios
  app.get('/api/v1/simulations', (req, res) => {
    res.json({
      total: savedSimulations.length,
      data: savedSimulations
    });
  });

  app.delete('/api/v1/simulations/:id', (req, res) => {
    savedSimulations = savedSimulations.filter(s => s.id !== req.params.id);
    res.json({ success: true, message: 'Escenario eliminado' });
  });

  // 7. AI Models Benchmark
  app.get('/api/v1/models', (req, res) => {
    res.json({
      models: currentView(req.query.month as string | undefined).benchmarks,
      disclaimer: 'Evaluación retrospectiva de baselines deterministas sobre consultas externas SIS; no hay una ST-GNN entrenada.'
    });
  });

  // 8. Data Sources
  app.get('/api/v1/data-sources', (req, res) => {
    res.json({
      sources: snapshot!.sources,
      syncStatus: syncState.status,
      lastMetropolitanETL: snapshot!.createdAt,
      version: snapshot!.version,
      error: syncState.error
    });
  });

  // 9. Equity & Fairness Metrics
  app.get('/api/v1/equity', (req, res) => {
    res.json({
      quintiles: currentView(req.query.month as string | undefined).equity,
      disclaimer: 'Pobreza INEI 2018 como aproximación de vulnerabilidad; acceso y capacidad estimados.'
    });
  });

  // 10. Dictamen técnico estructurado
  // Las tablas (indicadores, factores, IPRESS, vecinos) se construyen siempre
  // con los datos del motor. La capa agéntica solo redacta la narrativa; si no
  // responde, la narrativa se genera por reglas. El resultado es el mismo
  // documento en ambos casos, listo para mostrarse o exportarse a PDF.
  app.post('/api/v1/ai-analysis', async (req, res) => {
    const view = currentView(req.body.monthKey);
    const currentTerritories = view.territories, currentFacilities = view.facilities;
    const { districtId } = req.body;
    const territory = currentTerritories.find((t: any) => t.id === districtId);
    if (!territory) return res.status(404).json({ error: 'Distrito no encontrado' });

    const base = { ...construirDictamenBase(territory, currentTerritories, currentFacilities), datasetVersion: view.version, sources: view.sources };

    try {
      const agentRes = await fetch(`${AGENT_URL}/agent/dictamen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          districtId: territory.id,
          userRole: req.body.userRole ?? 'Investigador',
          facts: { distrito: { distrito: territory.name, ubigeo: territory.code,
            consultas_sis: territory.currentState.historicalDemand, mes_sis: view.month,
            poblacion: territory.population, pobreza_inei_2018: territory.sdoh.povertyRate,
            capacidad_estimada: territory.currentState.healthcareCapacity,
            accesibilidad_estimada: territory.currentState.accessibilityIndex,
            presion_estimada: territory.currentState.systemPressure,
            prioridad_derivada: territory.currentState.priorityIndex },
            vecinos: base.vecinos, indicadores: base.indicadores,
            version: view.version, fuentes: view.sources.map((source) => ({ id: source.id, period: source.period, pageUrl: source.pageUrl })) }
        }),
        signal: AbortSignal.timeout(90_000)
      });

      if (agentRes.ok) {
        const payload = await agentRes.json();
        const dictamen: DictamenTecnico = {
          ...base,
          narrativa: payload.narrativa,
          fuente: {
            origen: 'langchain-agent',
            modelo: payload.modelUsed,
            motor: 'DigitalTwinEngine · línea base oficial'
          }
        };
        return res.json({ success: true, dictamen, facts: payload.facts, datasetVersion: view.version, monthKey: view.month, sources: view.sources });
      }
      console.warn(`Agente respondió ${agentRes.status}; se usa la narrativa por reglas.`);
    } catch (err: any) {
      console.warn('Capa agéntica no disponible:', err?.message ?? err);
    }

    const dictamen: DictamenTecnico = {
      ...base,
      narrativa: narrativaPorReglas(base, territory),
      fuente: {
        origen: 'reglas',
        modelo: 'Sistema experto basado en reglas',
        motor: 'DigitalTwinEngine · línea base oficial'
      }
    };
    res.json({ success: true, dictamen, datasetVersion: view.version, monthKey: view.month, sources: view.sources });
  });

  // 11. Agente conversacional (proxy a FastAPI + LangChain)
  // El navegador habla solo con este origen; Express reenvía. Evita CORS y
  // deja un único punto de entrada para el frontend.
  app.post('/api/v1/agent/ask', async (req, res) => {
    try {
      const r = await fetch(`${AGENT_URL}/agent/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
        signal: AbortSignal.timeout(120_000)
      });
      const body = await r.json();
      res.status(r.status).json(body);
    } catch (err: any) {
      res.status(503).json({
        error: 'El servicio de agente no está disponible.',
        hint: 'Levántalo con: cd backend && .venv/Scripts/python -m uvicorn main:app --port 8000',
        detail: err?.message ?? String(err)
      });
    }
  });

  // 12. Recomendación operativa (proxy a Langflow vía FastAPI).
  // Independiente del dictamen LangChain: si Langflow está caído, el dictamen sigue.
  app.post('/api/v1/langflow/recomendacion', async (req, res) => {
    try {
      const view = currentView(req.body.monthKey);
      const district = view.territories.find((item) => item.id === req.body.districtId);
      if (!district) return res.status(404).json({ error: 'Distrito no encontrado' });
      const r = await fetch(`${AGENT_URL}/agent/recomendacion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ districtId: req.body.districtId, facts: {
          distrito: { distrito: district.name, ubigeo: district.code, poblacion: district.population,
            mes_sis: view.month, consultas_sis: district.currentState.historicalDemand,
            prioridad_derivada: district.currentState.priorityIndex,
            pobreza_inei_2018: district.sdoh.povertyRate,
            presion_estimada: district.currentState.systemPressure,
            acceso_estimado: district.currentState.accessibilityIndex },
          version: view.version, fuentes: view.sources.map((source) => ({ id: source.id, period: source.period, pageUrl: source.pageUrl })) } }),
        signal: AbortSignal.timeout(90_000)
      });
      const body = await r.json();
      res.status(r.status).json(body);
    } catch (err: any) {
      res.status(503).json({
        error: 'Langflow no está disponible.',
        hint: 'Levántalo con: docker start trusting_goodall',
        detail: err?.message ?? String(err)
      });
    }
  });

  app.get('/api/v1/agent/health', async (_req, res) => {
    try {
      const r = await fetch(`${AGENT_URL}/agent/health`, {
        signal: AbortSignal.timeout(5_000)
      });
      res.status(r.status).json(await r.json());
    } catch {
      res.json({ status: 'offline', llmReady: false });
    }
  });

  // ================= VITE DEV / PRODUCTION MIDDLEWARE =================
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Gemelo Digital Urbano de Salud - Trujillo running on http://localhost:${PORT}`);
  });
}

startServer();
