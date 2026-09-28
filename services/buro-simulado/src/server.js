import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8091;

app.use(cors());
app.use(express.json());

// Estado global del escenario simulado
let escenarioActual = {
  modo: 'NORMAL', // 'NORMAL' | 'LATENCIA_ALTA' | 'CAIDO'
  latenciaMs: 3000
};

// Log de solicitudes
app.use((req, res, next) => {
  console.log(`[Buró Simulado :${PORT}] ${req.method} ${req.url} - Modo: ${escenarioActual.modo}`);
  next();
});

/**
 * POST /admin/escenario y POST /v1/admin/escenario
 * Endpoint de administración obligatorio para configurar escenarios simulados
 */
const handleAdminEscenario = (req, res) => {
  const { modo, latenciaMs } = req.body || {};

  if (modo && !['NORMAL', 'LATENCIA_ALTA', 'CAIDO'].includes(modo)) {
    return res.status(400).json({
      codigo: 'PARAMETRO_INVALIDO',
      mensaje: 'El campo modo debe ser NORMAL, LATENCIA_ALTA o CAIDO'
    });
  }

  if (modo) escenarioActual.modo = modo;
  if (typeof latenciaMs === 'number' && latenciaMs >= 0) {
    escenarioActual.latenciaMs = latenciaMs;
  }

  console.log(`⚙️ [Buró Simulado] Escenario actualizado: modo=${escenarioActual.modo}, latenciaMs=${escenarioActual.latenciaMs}`);
  return res.status(204).send();
};

app.post('/admin/escenario', handleAdminEscenario);
app.post('/v1/admin/escenario', handleAdminEscenario);

/**
 * GET /admin/escenario
 * Permite consultar el escenario actual (helper dev)
 */
app.get('/admin/escenario', (req, res) => {
  res.json(escenarioActual);
});

/**
 * Endpoint de consulta de score: GET /score/:identificacion o GET /v1/score/:identificacion
 */
const handleScoreLookup = async (req, res) => {
  const { identificacion } = req.params;

  // 1. Simulación de Modo CAIDO
  if (escenarioActual.modo === 'CAIDO') {
    return res.status(503).json({
      codigo: 'BURO_NO_DISPONIBLE',
      mensaje: 'Servicio de Buró de Crédito temporalmente no disponible (modo CAIDO activo)'
    });
  }

  // 2. Simulación de LATENCIA_ALTA
  if (escenarioActual.modo === 'LATENCIA_ALTA') {
    const delay = escenarioActual.latenciaMs || 3000;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  // 3. Reglas de scoring deterministas
  let score = 760;
  let reportadoEnMora = false;

  if (identificacion.endsWith('88') || identificacion.startsWith('88')) {
    score = 420;
    reportadoEnMora = true;
  } else if (identificacion.endsWith('77') || identificacion.startsWith('77')) {
    score = 650;
    reportadoEnMora = false;
  } else if (identificacion.endsWith('66') || identificacion.startsWith('66')) {
    score = 520;
    reportadoEnMora = false;
  }

  return res.status(200).json({
    identificacion,
    score,
    reportadoEnMora
  });
};

app.get('/score/:identificacion', handleScoreLookup);
app.get('/v1/score/:identificacion', handleScoreLookup);

app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    service: 'Simulador de Buro Externo',
    escenario: escenarioActual,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🏦 Simulador de Buró Externo iniciado en puerto ${PORT}`);
  console.log(`⚙️ Admin endpoint: POST http://localhost:${PORT}/admin/escenario`);
  console.log(`📊 Score endpoint: GET http://localhost:${PORT}/v1/score/:identificacion`);
  console.log(`====================================================`);
});
