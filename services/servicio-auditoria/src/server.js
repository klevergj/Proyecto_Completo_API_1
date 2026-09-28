import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { conectarDB } from '../../backend/config/db.js';
import { AuditoriaModel } from '../../backend/models/Auditoria.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8095;

app.use(cors());
app.use(express.json());

// Conectar a MongoDB Atlas al iniciar
conectarDB().catch(err => console.error('Error al conectar MongoDB en servicio auditoría:', err.message));

const registrosMap = new Map();

app.use((req, res, next) => {
  console.log(`[Servicio Auditoría :${PORT}] ${req.method} ${req.url}`);
  next();
});

/**
 * POST /registros y POST /v1/registros
 * Guarda una nueva evaluación de crédito
 */
const handleGuardarRegistro = async (req, res) => {
  const registro = req.body || {};

  if (!registro.idEvaluacion) {
    return res.status(400).json({
      codigo: 'CAMPO_REQUERIDO',
      mensaje: 'El idEvaluacion es requerido'
    });
  }

  const nuevoRegistro = {
    idEvaluacion: registro.idEvaluacion,
    identificacion: registro.identificacion || registro.solicitud?.identificacion || 'DESCONOCIDA',
    decision: registro.decision,
    motivo: registro.motivo,
    fecha: registro.fecha || new Date().toISOString(),
    tiendaId: registro.tiendaId || registro.solicitud?.tiendaId || 'DESCONOCIDA',
    consultaBuroRealizada: Boolean(registro.consultaBuroRealizada),
    scoreBuro: registro.scoreBuro !== undefined ? registro.scoreBuro : null,
    reglasAplicadas: Array.isArray(registro.reglasAplicadas) ? registro.reglasAplicadas : []
  };

  try {
    const auditDoc = await AuditoriaModel.findOneAndUpdate(
      { idEvaluacion: nuevoRegistro.idEvaluacion },
      nuevoRegistro,
      { upsert: true, new: true }
    );
    registrosMap.set(nuevoRegistro.idEvaluacion, nuevoRegistro);

    console.log('✅ Registro de auditoría guardado en MongoDB Atlas');

    return res.status(201).json(auditDoc);
  } catch (error) {
    console.error('❌ Error al guardar auditoría en Mongo Atlas:', error.message);
    registrosMap.set(nuevoRegistro.idEvaluacion, nuevoRegistro);
    return res.status(201).json(nuevoRegistro);
  }
};

app.post('/registros', handleGuardarRegistro);
app.post('/v1/registros', handleGuardarRegistro);

/**
 * GET /registros y GET /v1/registros
 * Devuelve lista paginada y filtrada de auditorías
 */
const handleListarRegistros = (req, res) => {
  const { estado, fechaDesde, fechaHasta, tiendaId, page = 0, size = 20 } = req.query;

  let items = Array.from(registrosMap.values());

  // Filtros
  if (estado) {
    items = items.filter((item) => item.decision === estado);
  }

  if (tiendaId) {
    items = items.filter((item) => item.tiendaId === tiendaId);
  }

  if (fechaDesde) {
    const dDesde = new Date(fechaDesde);
    items = items.filter((item) => new Date(item.fecha) >= dDesde);
  }

  if (fechaHasta) {
    const dHasta = new Date(fechaHasta);
    items = items.filter((item) => new Date(item.fecha) <= dHasta);
  }

  // Ordenar por fecha descendente
  items.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  const total = items.length;
  const pageNum = parseInt(page, 10) || 0;
  const sizeNum = parseInt(size, 10) || 20;

  const startIndex = pageNum * sizeNum;
  const paginatedItems = items.slice(startIndex, startIndex + sizeNum);

  return res.status(200).json({
    total,
    page: pageNum,
    items: paginatedItems
  });
};

app.get('/registros', handleListarRegistros);
app.get('/v1/registros', handleListarRegistros);

/**
 * GET /registros/:id y GET /v1/registros/:id
 */
const handleObtenerRegistroPorId = (req, res) => {
  const { id } = req.params;
  const registro = registrosMap.get(id);

  if (!registro) {
    return res.status(404).json({
      codigo: 'REGISTRO_NO_ENCONTRADO',
      mensaje: `No existe ningún registro de auditoría con el ID ${id}`
    });
  }

  return res.status(200).json(registro);
};

app.get('/registros/:id', handleObtenerRegistroPorId);
app.get('/v1/registros/:id', handleObtenerRegistroPorId);

app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    service: 'Servicio de Auditoria',
    totalRegistros: registrosMap.size,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`📋 Servicio de Auditoría iniciado en puerto ${PORT}`);
  console.log(`📝 Registros endpoint: POST/GET http://localhost:${PORT}/v1/registros`);
  console.log(`====================================================`);
});
