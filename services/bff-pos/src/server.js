import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8081;
const CORE_SERVICE_URL = process.env.CORE_SERVICE_URL || 'http://localhost:8090';

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[BFF Punto de Venta :${PORT}] ${req.method} ${req.url}`);
  next();
});

function transformToResultadoPos(decisionCore) {
  const isAprobado = decisionCore.decision === 'APROBADO';
  let mensajeParaCliente = 'En revisión, te contactaremos';

  if (isAprobado) {
    mensajeParaCliente = `Crédito aprobado: ${decisionCore.motivo}`;
  } else if (decisionCore.decision === 'RECHAZADO') {
    mensajeParaCliente = `Crédito no aprobado: ${decisionCore.motivo}`;
  } else {
    mensajeParaCliente = `En revisión manual: ${decisionCore.motivo}`;
  }

  return {
    idEvaluacion: decisionCore.idEvaluacion,
    aprobado: isAprobado,
    mensajeParaCliente,
    // Atributos adicionales para soporte total de Spec 0 / Spec 1
    decision: decisionCore.decision,
    motivo: decisionCore.motivo,
    consultaBuroRealizada: decisionCore.consultaBuroRealizada,
    fecha: decisionCore.fecha
  };
}

/**
 * POST /evaluaciones-credito y POST /v1/evaluaciones-credito
 */
const handleCrearEvaluacionPos = async (req, res) => {
  try {
    const body = req.body || {};

    const response = await fetch(`${CORE_SERVICE_URL}/v1/evaluar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    const resultadoPos = transformToResultadoPos(data);
    return res.status(200).json(resultadoPos);
  } catch (error) {
    console.error('Error en BFF POS:', error);
    return res.status(500).json({
      codigo: 'ERROR_BFF_POS',
      mensaje: 'Error de comunicación entre BFF Punto de Venta y el Servicio Core de Evaluación'
    });
  }
};

app.post('/evaluaciones-credito', handleCrearEvaluacionPos);
app.post('/v1/evaluaciones-credito', handleCrearEvaluacionPos);

/**
 * GET /evaluaciones-credito/:id y GET /v1/evaluaciones-credito/:id
 */
const handleObtenerEstadoPos = async (req, res) => {
  try {
    const { id } = req.params;

    const response = await fetch(`${CORE_SERVICE_URL}/v1/evaluaciones/${id}`);
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    const resultadoPos = transformToResultadoPos(data);
    return res.status(200).json(resultadoPos);
  } catch (error) {
    console.error('Error en BFF POS GET:', error);
    return res.status(500).json({
      codigo: 'ERROR_BFF_POS',
      mensaje: 'Error al consultar estado de evaluación en BFF POS'
    });
  }
};

app.get('/evaluaciones-credito/:id', handleObtenerEstadoPos);
app.get('/v1/evaluaciones-credito/:id', handleObtenerEstadoPos);

app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    service: 'BFF Punto de Venta',
    coreUrl: CORE_SERVICE_URL,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🛒 BFF Punto de Venta iniciado en puerto ${PORT}`);
  console.log(`📡 Core URL: ${CORE_SERVICE_URL}`);
  console.log(`====================================================`);
});
