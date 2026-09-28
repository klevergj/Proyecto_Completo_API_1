const rateLimit = require("express-rate-limit");
const { identificadorCliente } = require("../utils/scopes");
const { limiteTasaExcedido } = require("../utils/errorGateway");

/**
 * Rate limiting POR CLIENTE (Req 3, steering tech.md): la clave es el
 * client_id del token ya verificado (azp / client_id), no la IP.
 *
 * MemoryStore: cuenta por instancia (ver tradeoff en design.md); para varias
 * replicas se inyecta un store compartido sin cambiar el resto.
 *
 * @param {{ rateLimitWindowMs: number, rateLimitMax: number, store?: Object }} opciones
 */
function crearLimiteTasa({ rateLimitWindowMs, rateLimitMax, store }) {
  return rateLimit({
    windowMs: rateLimitWindowMs,
    limit: rateLimitMax,
    standardHeaders: "draft-6", // RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset
    legacyHeaders: false,
    // Con OAuth2: por client_id. Sin autenticacion (modo temporal): por IP.
    keyGenerator: (req) => (req.auth ? `cliente:${identificadorCliente(req.auth)}` : `ip:${req.ip}`),
    ...(store ? { store } : {}),
    handler: (req, res) => {
      const error = limiteTasaExcedido();
      const resetMs = req.rateLimit && req.rateLimit.resetTime ? req.rateLimit.resetTime.getTime() - Date.now() : rateLimitWindowMs;
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil(resetMs / 1000))));
      res.status(error.status).json(error.toRespuesta());
    }
  });
}

module.exports = {
  crearLimiteTasa
};
