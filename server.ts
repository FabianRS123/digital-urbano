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
import { INITIAL_DISTRICTS, INITIAL_FACILITIES, AI_BENCHMARK_MODELS, DATA_SOURCES, EQUITY_METRICS, RISK_THRESHOLDS } from './src/data/trujilloData';
import { DigitalTwinEngine } from './src/lib/simulationEngine';
import { generateDistrictTimeSeries, getRiskFactorsExplanation } from './src/lib/spatiotemporalGnn';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // In-memory runtime state for simulation scenarios & dynamic edits
  let currentTerritories = JSON.parse(JSON.stringify(INITIAL_DISTRICTS));
  let currentFacilities = JSON.parse(JSON.stringify(INITIAL_FACILITIES));
  let savedSimulations: any[] = [];

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
    res.json({
      count: currentTerritories.length,
      data: currentTerritories
    });
  });

  app.get('/api/v1/territories/:id', (req, res) => {
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
    const sorted = [...currentTerritories].sort(
      (a: any, b: any) => b.currentState.priorityIndex - a.currentState.priorityIndex
    );
    res.json({
      thresholds: RISK_THRESHOLDS,
      hotspots: sorted
    });
  });

  // 4. Predictions / Time Series
  app.get('/api/v1/predictions/:districtId', (req, res) => {
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
      modelName: 'Spatiotemporal GNN (GAT + Temporal Attention)',
      modelVersion: 'ST-GNN-Trujillo-v1.4',
      forecast: points
    });
  });

  // 5. Intervention Simulator (What-if Engine)
  app.post('/api/v1/simulate', (req, res) => {
    try {
      const { params, scenarioName, authorRole } = req.body;
      if (!params || !params.targetDistrictId) {
        return res.status(400).json({ error: 'Parámetros de intervención incompletos' });
      }

      const result = DigitalTwinEngine.runSimulation(
        currentTerritories,
        currentFacilities,
        params,
        scenarioName || 'Escenario Simulado',
        authorRole || 'Investigador Principal'
      );

      savedSimulations.unshift(result);
      if (savedSimulations.length > 50) savedSimulations.pop();

      res.json({
        status: 'success',
        result
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
      models: AI_BENCHMARK_MODELS,
      disclaimer: 'Resultado demostrativo con datos sintéticos calibrados para el Área Metropolitana de Trujillo. No corresponde a evaluación médica causal definitiva.'
    });
  });

  // 8. Data Sources
  app.get('/api/v1/data-sources', (req, res) => {
    res.json({
      sources: DATA_SOURCES,
      syncStatus: 'Sincronizado',
      lastMetropolitanETL: '2026-08-20T04:00:00Z'
    });
  });

  // 9. Equity & Fairness Metrics
  app.get('/api/v1/equity', (req, res) => {
    res.json({
      quintiles: EQUITY_METRICS,
      overallGiniSanitaryDeficit: 0.38,
      equityIndex: 0.74,
      disclaimer: 'Desagregación de métricas de desempeño del modelo según quintiles de vulnerabilidad socioeconómica.'
    });
  });

  // 10. Dictamen técnico estructurado
  // Las tablas (indicadores, factores, IPRESS, vecinos) se construyen siempre
  // con los datos del motor. La capa agéntica solo redacta la narrativa; si no
  // responde, la narrativa se genera por reglas. El resultado es el mismo
  // documento en ambos casos, listo para mostrarse o exportarse a PDF.
  app.post('/api/v1/ai-analysis', async (req, res) => {
    const { districtId } = req.body;
    const territory =
      currentTerritories.find((t: any) => t.id === districtId) || currentTerritories[1];

    const base = construirDictamenBase(territory, currentTerritories, currentFacilities);

    try {
      const agentRes = await fetch(`${AGENT_URL}/agent/dictamen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          districtId: territory.id,
          userRole: req.body.userRole ?? 'Investigador'
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
            motor: 'DigitalTwinEngine · ST-GNN-Trujillo-v1.4'
          }
        };
        return res.json({ success: true, dictamen, facts: payload.facts });
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
        motor: 'DigitalTwinEngine · ST-GNN-Trujillo-v1.4'
      }
    };
    res.json({ success: true, dictamen });
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
      const r = await fetch(`${AGENT_URL}/agent/recomendacion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ districtId: req.body.districtId }),
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
