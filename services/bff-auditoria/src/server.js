import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8082;
const AUDIT_SERVICE_URL = process.env.AUDIT_SERVICE_URL || 'http://localhost:8095';

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[BFF Auditoría :${PORT}] ${req.method} ${req.url}`);
  next();
});

/**
 * GET /evaluaciones y GET /v1/evaluaciones
 * Lista evaluaciones con filtros y paginación para el panel de analistas
 */
const handleListarEvaluacionesAuditoria = async (req, res) => {
  try {
    const queryParams = new URLSearchParams(req.query).toString();
    const targetUrl = `${AUDIT_SERVICE_URL}/v1/registros${queryParams ? `?${queryParams}` : ''}`;

    const response = await fetch(targetUrl);
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Error en BFF Auditoría:', error);
    return res.status(500).json({
      codigo: 'ERROR_BFF_AUDITORIA',
      mensaje: 'Error de comunicación entre BFF Auditoría y Servicio de Auditoría'
    });
  }
};

app.get('/evaluaciones', handleListarEvaluacionesAuditoria);
app.get('/v1/evaluaciones', handleListarEvaluacionesAuditoria);

/**
 * GET /evaluaciones/:id/detalle y GET /v1/evaluaciones/:id/detalle
 * Detalle completo de una evaluación
 */
const handleObtenerDetalleAuditoria = async (req, res) => {
  try {
    const { id } = req.params;

    const response = await fetch(`${AUDIT_SERVICE_URL}/v1/registros/${id}`);
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Error en BFF Auditoría GET Detalle:', error);
    return res.status(500).json({
      codigo: 'ERROR_BFF_AUDITORIA',
      mensaje: 'Error al consultar detalle de auditoría'
    });
  }
};

app.get('/evaluaciones/:id/detalle', handleObtenerDetalleAuditoria);
app.get('/v1/evaluaciones/:id/detalle', handleObtenerDetalleAuditoria);

app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    service: 'BFF Auditoria',
    auditUrl: AUDIT_SERVICE_URL,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🔍 BFF Auditoría iniciado en puerto ${PORT}`);
  console.log(`📡 Audit Service URL: ${AUDIT_SERVICE_URL}`);
  console.log(`====================================================`);
});
