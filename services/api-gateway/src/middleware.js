import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_key_resuelve_openapi_2026';

import rateLimit from 'express-rate-limit';

/**
 * Rate Limiting Middleware por client_id o IP
 */
export const rateLimiterMiddleware = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 100, // Límite de 100 peticiones por ventana
  keyGenerator: (req) => {
    return req.user?.client_id || req.ip; // Por Client ID o IP
  },
  handler: (req, res) => {
    res.status(429).json({
      codigo: 'RATE_LIMIT_EXCEEDED',
      mensaje: `Demasiadas solicitudes. Por favor, espere unos segundos.`
    });
  }
});

/**
 * Middleware para validar Token JWT OAuth2 y Scopes requeridos
 */
export const verifyOAuthTokenAndScope = (requiredScope) => {
  return (req, res, next) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        codigo: 'TOKEN_AUSENTE',
        mensaje: 'Token de acceso no proporcionado en la cabecera Authorization (Bearer Token requerido)'
      });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;

      // Validar Scope
      if (requiredScope) {
        const scopes = Array.isArray(decoded.scopes) ? decoded.scopes : (decoded.scope ? decoded.scope.split(' ') : []);
        
        if (!scopes.includes(requiredScope)) {
          return res.status(403).json({
            codigo: 'SCOPE_INSUFICIENTE',
            mensaje: `Acceso denegado. Se requiere el scope '${requiredScope}'`
          });
        }
      }

      next();
    } catch (err) {
      return res.status(401).json({
        codigo: 'TOKEN_INVALIDO',
        mensaje: 'Token OAuth2 inválido o expirado'
      });
    }
  };
};
