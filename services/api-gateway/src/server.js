import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { verifyOAuthTokenAndScope, rateLimiterMiddleware } from './middleware.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_key_resuelve_openapi_2026';

const BFF_POS_URL = process.env.BFF_POS_URL || 'http://localhost:8081';
const BFF_AUDITORIA_URL = process.env.BFF_AUDITORIA_URL || 'http://localhost:8082';

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[API Gateway :${PORT}] ${req.method} ${req.url}`);
  next();
});

/**
 * POST /oauth/token
 * Autenticación OAuth2 Client Credentials Flow
 */
app.post('/oauth/token', (req, res) => {
  const { grant_type, client_id, client_secret } = req.body || {};

  if (grant_type && grant_type !== 'client_credentials') {
    return res.status(400).json({
      codigo: 'GRANT_TYPE_INVALIDO',
      mensaje: 'El parámetro grant_type debe ser client_credentials'
    });
  }

  const clientId = client_id || 'frontend-tiendas';
  const scopes = ['evaluaciones:escribir', 'evaluaciones:leer', 'auditoria:leer'];

  const payload = {
    client_id: clientId,
    scopes,
    iss: 'https://auth.resuelve.com'
  };

  const access_token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

  return res.json({
    access_token,
    token_type: 'Bearer',
    expires_in: 3600,
    scope: scopes.join(' ')
  });
});

/**
 * RUTAS DE ENRUTAMIENTO (PROXY INTERNO)
 */

// 1. POST /v1/evaluaciones-credito (BFF POS)
app.post(
  '/v1/evaluaciones-credito',
  verifyOAuthTokenAndScope('evaluaciones:escribir'),
  rateLimiterMiddleware,
  async (req, res) => {
    try {
      const response = await fetch(`${BFF_POS_URL}/v1/evaluaciones-credito`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      });

      const data = await response.json();
      return res.status(response.status).json(data);
    } catch (err) {
      console.error('Error en Gateway al enrutar a BFF POS:', err);
      return res.status(502).json({
        codigo: 'GATEWAY_ERROR',
        mensaje: 'Error de comunicación con el servicio BFF Punto de Venta'
      });
    }
  }
);

// 2. GET /v1/evaluaciones-credito/:id (BFF POS)
app.get(
  '/v1/evaluaciones-credito/:id',
  verifyOAuthTokenAndScope('evaluaciones:leer'),
  rateLimiterMiddleware,
  async (req, res) => {
    try {
      const { id } = req.params;
      const response = await fetch(`${BFF_POS_URL}/v1/evaluaciones-credito/${id}`);
      const data = await response.json();
      return res.status(response.status).json(data);
    } catch (err) {
      console.error('Error en Gateway GET a BFF POS:', err);
      return res.status(502).json({
        codigo: 'GATEWAY_ERROR',
        mensaje: 'Error de comunicación con BFF Punto de Venta'
      });
    }
  }
);

// 3. GET /v1/auditoria/evaluaciones (BFF Auditoría)
app.get(
  '/v1/auditoria/evaluaciones',
  verifyOAuthTokenAndScope('auditoria:leer'),
  rateLimiterMiddleware,
  async (req, res) => {
    try {
      const queryParams = new URLSearchParams(req.query).toString();
      const targetUrl = `${BFF_AUDITORIA_URL}/v1/evaluaciones${queryParams ? `?${queryParams}` : ''}`;

      const response = await fetch(targetUrl);
      const data = await response.json();
      return res.status(response.status).json(data);
    } catch (err) {
      console.error('Error en Gateway GET a BFF Auditoría:', err);
      return res.status(502).json({
        codigo: 'GATEWAY_ERROR',
        mensaje: 'Error de comunicación con BFF Auditoría'
      });
    }
  }
);

// 4. GET /v1/auditoria/evaluaciones/:id/detalle (BFF Auditoría)
app.get(
  '/v1/auditoria/evaluaciones/:id/detalle',
  verifyOAuthTokenAndScope('auditoria:leer'),
  rateLimiterMiddleware,
  async (req, res) => {
    try {
      const { id } = req.params;
      const response = await fetch(`${BFF_AUDITORIA_URL}/v1/evaluaciones/${id}/detalle`);
      const data = await response.json();
      return res.status(response.status).json(data);
    } catch (err) {
      console.error('Error en Gateway GET Detalle Auditoría:', err);
      return res.status(502).json({
        codigo: 'GATEWAY_ERROR',
        mensaje: 'Error de comunicación con BFF Auditoría'
      });
    }
  }
);

app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    service: 'API Gateway Resuelve',
    bffPosUrl: BFF_POS_URL,
    bffAuditoriaUrl: BFF_AUDITORIA_URL,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 API Gateway iniciado en el puerto ${PORT}`);
  console.log(`🔑 OAuth Token URL: http://localhost:${PORT}/oauth/token`);
  console.log(`📡 Enrutando a BFF POS (${BFF_POS_URL}) y BFF Auditoría (${BFF_AUDITORIA_URL})`);
  console.log(`====================================================`);
});
