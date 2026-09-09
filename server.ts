// Carga .env / .env.local antes de leer cualquier process.env. Sin esto, las
// claves colocadas en un archivo se ignoraban y solo servían las variables de
// entorno del sistema.
import 'dotenv/config';
import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

// Servicio de agente (FastAPI + LangChain). Es opcional: si no está levantado,
// el dictamen cae a Gemini y, en su defecto, al texto determinista.
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

  // Initialize Gemini AI Client (Server-side only)
  let ai: GoogleGenAI | null = null;
  if (process.env.GEMINI_API_KEY) {
    try {
      ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });
    } catch (e) {
      console.warn('Gemini API initialization warning:', e);
    }
  }

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

  // 10. AI Executive Brief Synthesis (Gemini API)
  app.post('/api/v1/ai-analysis', async (req, res) => {
    const { districtId, topic } = req.body;
    const territory = currentTerritories.find((t: any) => t.id === districtId) || currentTerritories[1]; // default El Porvenir

    // Preferencia 1: capa agéntica. Recoge las métricas del motor con sus
    // herramientas y devuelve el registro de evidencia junto al dictamen, así
    // que es la única vía cuyas cifras son auditables.
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
        return res.json({
          success: true,
          analysis: payload.analysis,
          facts: payload.facts,
          modelUsed: payload.modelUsed,
          source: 'langchain-agent'
        });
      }
      console.warn(`Agente respondió ${agentRes.status}; se intenta Gemini.`);
    } catch (err: any) {
      // Servicio caído o sin clave: no es un error del usuario, se degrada.
      console.warn('Capa agéntica no disponible:', err?.message ?? err);
    }

    if (ai) {
      try {
        const prompt = `Actúa como especialista epidemiólogo y analista de salud pública del "Gemelo Digital Urbano de Salud - Trujillo, Perú".
Genera un dictamen técnico breve, profesional y estructurado para el distrito de ${territory.name}.
Datos del distrito:
- Población: ${territory.population.toLocaleString()} hab (Densidad: ${territory.density} hab/km2)
- Índice de Vulnerabilidad SDOH: ${territory.sdoh.vulnerabilityIndex} (Pobreza: ${(territory.sdoh.povertyRate * 100).toFixed(0)}%, Déficit saneamiento: ${(territory.sdoh.sanitationDeficit * 100).toFixed(0)}%)
- Accesibilidad Sanitaria: ${(territory.currentState.accessibilityIndex * 100).toFixed(0)}% (Tiempo promedio de viaje: ${territory.currentState.avgTravelTimeMinutes} min)
- Demanda Mensual: ${territory.currentState.historicalDemand.toLocaleString()} atenciones (Capacidad: ${territory.currentState.healthcareCapacity.toLocaleString()})
- Presión Asistencial: ${(territory.currentState.systemPressure * 100).toFixed(0)}%
- Índice de Prioridad Territorial: ${territory.currentState.priorityIndex} (Categoría: ${territory.currentState.hotspotCategory})

Incluye:
1. Diagnóstico de la situación espacio-temporal.
2. Recomendación prioritaria de intervención (Infraestructura / Accesibilidad / Equipamiento).
3. Advertencia ética sobre no causalidad directa de las estimaciones.`;

        const aiResponse = await ai.models.generateContent({
          model: 'gemini-3.7-flash',
          contents: prompt,
        });

        return res.json({
          success: true,
          analysis: aiResponse.text,
          modelUsed: 'gemini-3.7-flash'
        });
      } catch (err: any) {
        console.error('Gemini synthesis failed, fallback to rule-based synthesis:', err);
      }
    }

    // High quality deterministic public health fallback
    const fallbackText = `### Dictamen Técnico Epidemiológico — ${territory.name}
**1. Diagnóstico de Situación:**
El distrito presenta un Índice de Prioridad Territorial de **${territory.currentState.priorityIndex} (${territory.currentState.hotspotCategory})**, impulsado por un déficit de accesibilidad del ${((1 - territory.currentState.accessibilityIndex) * 100).toFixed(0)}% y una sobrecarga asistencial del ${((territory.currentState.systemPressure - 1) * 100).toFixed(0)}%. Los determinantes sociales (pobreza ${(territory.sdoh.povertyRate * 100).toFixed(0)}% y falta de saneamiento ${(territory.sdoh.sanitationDeficit * 100).toFixed(0)}%) intensifican la concentración de casos prevenibles.

**2. Recomendación de Intervención:**
Se sugiere priorizar la instalación de un establecimiento de primer nivel (categoría I-3/I-4) o corredor vial sociosanitario que reduzca el tiempo medio de traslado a menos de 20 minutos, disminuyendo la presión asistencial sobre los hospitales centrales de Trujillo.

*Nota ética: Los resultados son estimaciones del modelo predictivo espacio-temporal y constituyen una guía de apoyo a la decisión, no un veredicto causal irrefutable.*`;

    res.json({
      success: true,
      analysis: fallbackText,
      modelUsed: 'rule-based-expert-system',
      source: 'fallback'
    });
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
