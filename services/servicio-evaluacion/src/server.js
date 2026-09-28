import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ejecutarEvaluacionCore, getCircuitBreakerState } from './ruleEngine.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8090;

app.use(cors());
app.use(express.json());

// In-memory cache de evaluaciones procesadas
const evaluacionesLocalMap = new Map();

app.use((req, res, next) => {
  console.log(`[Servicio Evaluación Core :${PORT}] ${req.method} ${req.url}`);
  next();
});

/**
 * POST /evaluar y POST /v1/evaluar
 */
const handleEvaluarCredito = async (req, res) => {
  try {
    const { identificacion, montoSolicitado, plazoMeses, tiendaId } = req.body || {};

    if (!identificacion || typeof identificacion !== 'string' || !identificacion.trim()) {
      return res.status(400).json({
        codigo: 'IDENTIFICACION_INVALIDA',
        mensaje: 'La identificación es requerida'
      });
    }

    const numericMonto = parseFloat(montoSolicitado);
    if (isNaN(numericMonto) || numericMonto <= 0) {
      return res.status(400).json({
        codigo: 'MONTO_INVALIDO',
        mensaje: 'El monto solicitado debe ser un valor numérico mayor a 0'
      });
    }

    const numericPlazo = parseInt(plazoMeses, 10);
    if (isNaN(numericPlazo) || numericPlazo <= 0) {
      return res.status(400).json({
        codigo: 'PLAZO_INVALIDO',
        mensaje: 'El plazo en meses debe ser un entero mayor a 0'
      });
    }

    const resultado = await ejecutarEvaluacionCore({
      identificacion: identificacion.trim(),
      montoSolicitado: numericMonto,
      plazoMeses: numericPlazo,
      tiendaId: tiendaId || 'STORE-POS-01'
    });

    evaluacionesLocalMap.set(resultado.idEvaluacion, resultado);

    return res.status(200).json(resultado);
  } catch (error) {
    console.error('Error procesando evaluacion core:', error);
    return res.status(500).json({
      codigo: 'ERROR_INTERNO_CORE',
      mensaje: 'Ocurrió un error al procesar la evaluación de crédito en el core'
    });
  }
};

app.post('/evaluar', handleEvaluarCredito);
app.post('/v1/evaluar', handleEvaluarCredito);

/**
 * GET /evaluaciones/:id y GET /v1/evaluaciones/:id
 */
const handleObtenerEvaluacion = async (req, res) => {
  const { id } = req.params;

  let resultado = evaluacionesLocalMap.get(id);

  if (!resultado) {
    // Intentar consultar al servicio de auditoría
    const auditUrl = process.env.AUDIT_SERVICE_URL || 'http://localhost:8095';
    try {
      const resp = await fetch(`${auditUrl}/v1/registros/${id}`);
      if (resp.ok) {
        resultado = await resp.json();
      }
    } catch (e) {
      console.warn(`No se pudo consultar auditoría para id ${id}`);
    }
  }

  if (!resultado) {
    return res.status(404).json({
      codigo: 'EVALUACION_NO_ENCONTRADA',
      mensaje: `No existe evaluación registrada con ID ${id}`
    });
  }

  return res.status(200).json(resultado);
};

app.get('/evaluaciones/:id', handleObtenerEvaluacion);
app.get('/v1/evaluaciones/:id', handleObtenerEvaluacion);

app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    service: 'Servicio de Evaluacion de Credito (Core)',
    circuitBreaker: getCircuitBreakerState(),
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🧠 Servicio Core de Evaluación iniciado en puerto ${PORT}`);
  console.log(`📋 Evaluar endpoint: POST http://localhost:${PORT}/v1/evaluar`);
  console.log(`====================================================`);
});
