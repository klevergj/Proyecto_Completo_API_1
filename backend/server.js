import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import CircuitBreaker from 'opossum';

import { conectarDB } from './config/db.js';
import { enviarNotificacionBD } from './helpers/notificaciones.js';
import { ClienteHistorialModel } from './models/ClienteHistorial.js';
import { BuroCreditoModel } from './models/BuroCredito.js';
import { AuditoriaModel } from './models/Auditoria.js';

dotenv.config();

const app = express();
// Configuración de Puerto por contrato OpenAPI (Gateway: 8080)
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_key_resuelve_openapi_2026';

// 1. CONFIGURACIÓN DE CORS Y MIDDLEWARES
app.use(cors({
  origin: '*', // Habilitar CORS para http://localhost:5173, Postman y cualquier origen
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Log general de peticiones en consola
app.use((req, res, next) => {
  console.log(`[API Gateway / Backend :${PORT}] ${req.method} ${req.url}`);
  next();
});

// Middleware de Autenticación Permisivo (no bloquea peticiones sin Bearer token)
function autenticarOAuthPermisivo(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.usuario = decoded;
  } catch (error) {
    console.warn('⚠️ Token OAuth no válido o expirado, procesando petición de forma pública.');
  }
  next();
}

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 100, // Límite de 100 peticiones
  keyGenerator: (req) => {
    return req.usuario?.client_id || req.ip;
  },
  handler: (req, res) => {
    res.status(429).json({
      codigo: 'LIMITE_TASA_EXCEDIDO',
      mensaje: 'Demasiadas solicitudes. Por favor, espere unos segundos.'
    });
  }
});

app.use('/v1/', apiLimiter);

const consultarBuroConOpossum = async (identificacion) => {
  return await BuroCreditoModel.findOne({ identificacion }).lean();
};

const buroCircuitBreaker = new CircuitBreaker(consultarBuroConOpossum, {
  timeout: 1500, // Timeout de 1500 ms
  errorThresholdPercentage: 50,
  resetTimeout: 10000
});

buroCircuitBreaker.fallback((identificacion, error) => {
  console.warn(`⚡ [CircuitBreaker] Buró no disponible o timeout para ${identificacion}. Error: ${error.message}. Activando Fallback...`);
  return { esFallback: true }; // Señalizamos que es un fallback
});

// ----------------------------------------------------------------------
// ENDPOINT OAUTH2 CLIENT CREDENTIALS (Spec 0 / Gateway)
// ----------------------------------------------------------------------
app.post('/oauth/token', (req, res) => {
  const { grant_type, client_id } = req.body || {};

  if (grant_type && grant_type !== 'client_credentials') {
    return res.status(400).json({
      codigo: 'GRANT_TYPE_INVALIDO',
      mensaje: 'El parámetro grant_type debe ser client_credentials'
    });
  }

  const payload = {
    client_id: client_id || 'frontend-tiendas',
    scopes: ['evaluaciones:escribir', 'evaluaciones:leer', 'auditoria:leer'],
    iss: 'https://auth.resuelve.com'
  };

  const access_token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

  return res.json({
    access_token,
    token_type: 'Bearer',
    expires_in: 3600,
    scope: 'evaluaciones:escribir evaluaciones:leer auditoria:leer'
  });
});

// ----------------------------------------------------------------------
// ENDPOINT POST /v1/evaluaciones-credito (CONTRATO OPENAPI SPEC 0 / SPEC 1)
// ----------------------------------------------------------------------
app.post(
  ['/v1/evaluaciones-credito', '/api/evaluaciones-credito', '/evaluaciones-credito'],
  autenticarOAuthPermisivo,
  async (req, res) => {
    try {
      const { identificacion, montoSolicitado, plazoMeses, tiendaId } = req.body || {};

      if (!identificacion) {
        return res.status(400).json({
          codigo: 'PARAMETROS_INVALIDOS',
          mensaje: 'La identificación es requerida'
        });
      }

      const cedula = String(identificacion).trim();
      const montoNum = Number(montoSolicitado) || 0;
      console.log(`🔍 Procesando evaluación OpenAPI para cédula: ${cedula} (Monto: $${montoNum})`);

      // 1. CONSULTAR EN MONGODB ATLAS (resuelve_db) AMBAS COLECCIONES
      const historial = await ClienteHistorialModel.findOne({ identificacion: cedula }).lean();
      
      let buro = null;
      let esFallback = false;
      try {
        buro = await buroCircuitBreaker.fire(cedula);
        if (buro?.esFallback) {
          esFallback = true;
          buro = null;
        }
      } catch (err) {
        esFallback = true;
        buro = null;
      }

      let decision = 'APROBADO';
      let motivo = 'Cumple reglas de score y capacidad de pago';

      const tieneMora = Boolean(
        historial?.tieneMoraVigente || 
        buro?.tieneMoraBuro || 
        buro?.reportadoEnMora
      );

      // 2. APLICAR REGLAS DE NEGOCIO REALES (CONTRATO OPENAPI)
      if (tieneMora) {
        decision = 'RECHAZADO';
        motivo = 'Mora vigente en historial interno o buró';
      } else if (!esFallback && buro?.score !== undefined && buro?.score !== null && buro.score < 700) {
        decision = 'RECHAZADO';
        motivo = 'Score de buró de crédito insuficiente';
      } else if (montoNum > 5000) {
        decision = 'REVISION_MANUAL';
        motivo = 'Requiere aprobación por monto elevado';
      } else if (!historial && !buro && !esFallback) {
        decision = 'RECHAZADO';
        motivo = 'La identificación no se encuentra registrada en el sistema ni en el Buró de Crédito';
      } else if (!historial && esFallback) {
        decision = 'REVISION_MANUAL';
        motivo = 'Cliente nuevo sin historial interno y buró no disponible';
      } else if (esFallback) {
        decision = 'APROBADO';
        motivo = 'Aprobado basado 100% en historial interno (Fallback Buró)';
      }

      const idEvaluacion = uuidv4();
      const fechaActual = new Date().toISOString();
      const consultaBuroRealizada = Boolean(buro);
      const scoreRealBuro = buro ? (buro.score ?? 0) : 0;

      // 3. PERSISTENCIA OBLIGATORIA EN LA COLECCIÓN auditorias DE MONGO ATLAS
      try {
        await AuditoriaModel.create({
          idEvaluacion,
          identificacion: cedula,
          decision,
          motivo,
          fecha: fechaActual,
          tiendaId: tiendaId || 'TIENDA-001',
          consultaBuroRealizada,
          scoreBuro: scoreRealBuro,
          reglasAplicadas: [
            { regla: 'Regla_Mora_Vigente', resultado: tieneMora ? 'FALLO' : 'PASO' },
            { regla: 'Regla_Score_Buro', resultado: (buro?.score >= 700) ? 'PASO' : 'FALLO' },
            { regla: 'Regla_Monto_Maximo', resultado: (montoNum <= 5000) ? 'PASO' : 'REVISION' }
          ]
        });

        console.log('✅ Registro de auditoría guardado en MongoDB Atlas');
      } catch (errMongo) {
        console.error('❌ Error al guardar en colección auditorias de Mongo Atlas:', errMongo.message);
      }

      // 4. NOTIFICACIÓN POR WEBHOOK SLACK/DISCORD
      enviarNotificacionBD('Evaluación Crédito OpenAPI', {
        idEvaluacion,
        identificacion: cedula,
        decision,
        motivo,
        consultaBuroRealizada,
        scoreBuro: scoreRealBuro,
        tiendaId: tiendaId || 'TIENDA-001'
      }).catch(errWb => console.warn('⚠️ Alerta Webhook diferida:', errWb.message));

      // 5. RESPUESTA MAPEADA EXACTAMENTE AL CONTRATO FRONTEND (Spec 0 / Spec 1)
      return res.status(200).json({
        idEvaluacion,
        decision,
        aprobado: decision === 'APROBADO',
        motivo,
        consultaBuroRealizada,
        fecha: fechaActual
      });

    } catch (error) {
      console.error('❌ Error general al evaluar crédito:', error);
      return res.status(500).json({
        codigo: 'ERROR_INTERNO',
        mensaje: 'Error al procesar la evaluación de crédito'
      });
    }
  }
);

// ----------------------------------------------------------------------
// ENDPOINT GET /v1/evaluaciones-credito/:id (Spec 0 / Spec 1)
// ----------------------------------------------------------------------
app.get(['/v1/evaluaciones-credito/:id', '/api/evaluaciones-credito/:id'], async (req, res) => {
  try {
    const { id } = req.params;
    const auditoria = await AuditoriaModel.findOne({ idEvaluacion: id }).lean();

    if (!auditoria) {
      return res.status(404).json({
        codigo: 'EVALUACION_NO_ENCONTRADA',
        mensaje: `No existe evaluación registrada con ID ${id}`
      });
    }

    return res.status(200).json({
      idEvaluacion: auditoria.idEvaluacion,
      decision: auditoria.decision,
      aprobado: auditoria.decision === 'APROBADO',
      motivo: auditoria.motivo,
      consultaBuroRealizada: auditoria.consultaBuroRealizada,
      fecha: auditoria.fecha
    });
  } catch (error) {
    return res.status(500).json({ codigo: 'ERROR_BD', mensaje: error.message });
  }
});

// ----------------------------------------------------------------------
// OTROS ENDPOINTS (Historial, Buró y Auditorías)
// ----------------------------------------------------------------------
app.get(['/v1/clientes/:identificacion/historial', '/api/clientes/:identificacion/historial'], async (req, res) => {
  const { identificacion } = req.params;
  try {
    const cliente = await ClienteHistorialModel.findOne({ identificacion }).lean();
    if (!cliente) {
      return res.status(404).json({ codigo: 'CLIENTE_NO_ENCONTRADO', mensaje: `No existe historial para ${identificacion}` });
    }
    return res.status(200).json(cliente);
  } catch (error) {
    return res.status(500).json({ codigo: 'ERROR_BD', mensaje: error.message });
  }
});

app.get(['/v1/score/:identificacion', '/api/score/:identificacion'], async (req, res) => {
  const { identificacion } = req.params;
  try {
    const buro = await BuroCreditoModel.findOne({ identificacion }).lean();
    if (!buro) {
      return res.status(404).json({ codigo: 'BURO_NO_ENCONTRADO', mensaje: `No existe score de buró para ${identificacion}` });
    }
    return res.status(200).json(buro);
  } catch (error) {
    return res.status(500).json({ codigo: 'ERROR_BD', mensaje: error.message });
  }
});

app.get(['/v1/auditoria/evaluaciones', '/api/auditoria/evaluaciones'], async (req, res) => {
  try {
    const { page = 1, limit = 10, size, fechaDesde, fechaHasta, decision } = req.query;
    const limitNum = parseInt(size || limit, 10) || 10;
    const pageNum = parseInt(page, 10) || 1;
    const skip = (pageNum - 1) * limitNum;

    const query = {};
    if (decision) {
      query.decision = decision;
    }
    if (fechaDesde || fechaHasta) {
      query.fecha = {};
      if (fechaDesde) query.fecha.$gte = new Date(fechaDesde);
      if (fechaHasta) query.fecha.$lte = new Date(fechaHasta);
    }

    const [total, data] = await Promise.all([
      AuditoriaModel.countDocuments(query),
      AuditoriaModel.find(query).sort({ fecha: -1 }).skip(skip).limit(limitNum).lean()
    ]);

    const totalPages = Math.ceil(total / limitNum);

    return res.status(200).json({ total, page: pageNum, limit: limitNum, totalPages, data });
  } catch (error) {
    return res.status(500).json({ codigo: 'ERROR_AUDITORIA', mensaje: error.message });
  }
});

// HEALTH CHECK
app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    service: 'API Backend Resuelve (OpenAPI 8080)',
    port: PORT,
    database: 'MongoDB Atlas (resuelve_db)',
    timestamp: new Date().toISOString()
  });
});

// ----------------------------------------------------------------------
// ARRANQUE DEL SERVIDOR Y CONEXIÓN A MONGO ATLAS
// ----------------------------------------------------------------------
async function iniciarServidor() {
  try {
    await conectarDB();
    app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`🚀 Servidor Backend Express ejecutándose en puerto ${PORT}`);
      console.log(`🌐 Base de Datos: MongoDB Atlas (resuelve_db)`);
      console.log(`📋 Especificación OpenAPI: Spec 0 / Spec 1 (http://localhost:${PORT}/v1/evaluaciones-credito)`);
      console.log(`====================================================`);
    });
  } catch (err) {
    console.error('❌ Error crítico al conectar a MongoDB Atlas:', err.message);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  iniciarServidor();
}

export default app;