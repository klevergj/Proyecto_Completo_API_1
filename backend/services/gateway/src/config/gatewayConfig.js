/**
 * Configuracion del API Gateway. Lee process.env UNA sola vez.
 *
 * AUTH_HABILITADA (por defecto true): con OAuth2 activo, JWT_ISSUER,
 * JWT_AUDIENCE y JWKS_URI son obligatorios y el arranque falla sin ellos.
 * Solo el valor explicito "false" desactiva la autenticacion (modo temporal
 * hasta integrar el Frontend con tokens); nunca se desactiva por omision.
 */

const path = require("path");

const DEFAULTS = Object.freeze({
  port: 8080,
  metricsPort: 9464,
  jwksTimeoutMs: 3000,
  bffPosUrl: "http://bff-punto-venta:8081",
  bffPosTimeoutMs: 6000, // > CORE_TIMEOUT_MS (5000) del BFF POS
  bffAuditoriaUrl: "http://bff-auditoria:8082",
  bffAuditoriaTimeoutMs: 4000, // > AUDITORIA_TIMEOUT_MS (3000) del BFF Auditoria
  rateLimitWindowMs: 60000,
  rateLimitMax: 100
});

const estaVacio = (v) => v === undefined || v === null || String(v).trim() === "";

function enteroPositivo(nombre, valorEnv, porDefecto) {
  if (estaVacio(valorEnv)) return porDefecto;
  const numero = Number(valorEnv);
  if (!Number.isInteger(numero) || numero <= 0) {
    console.warn(`[Gateway Config] ${nombre}="${valorEnv}" invalido; se usa el default ${porDefecto}`);
    return porDefecto;
  }
  return numero;
}

function obligatorio(nombre, valorEnv) {
  if (estaVacio(valorEnv)) {
    throw new Error(`[Gateway Config] Falta la variable obligatoria ${nombre} (autenticacion OAuth2)`);
  }
  return String(valorEnv).trim();
}

/**
 * @param {Object} env objeto de entorno (inyectable en pruebas)
 */
function crearGatewayConfig(env = process.env) {
  const authHabilitada = String(env.AUTH_HABILITADA || "").trim().toLowerCase() !== "false";
  const oauth2 = authHabilitada
    ? {
        jwtIssuer: obligatorio("JWT_ISSUER", env.JWT_ISSUER),
        jwtAudience: obligatorio("JWT_AUDIENCE", env.JWT_AUDIENCE),
        jwksUri: obligatorio("JWKS_URI", env.JWKS_URI)
      }
    : { jwtIssuer: null, jwtAudience: null, jwksUri: null };

  return {
    port: enteroPositivo("PORT", env.PORT, DEFAULTS.port),
    metricsPort: enteroPositivo("METRICS_PORT", env.METRICS_PORT, DEFAULTS.metricsPort),
    nodeEnv: env.NODE_ENV,
    authHabilitada,
    ...oauth2,
    jwksTimeoutMs: enteroPositivo("JWKS_TIMEOUT_MS", env.JWKS_TIMEOUT_MS, DEFAULTS.jwksTimeoutMs),
    bffPosUrl: estaVacio(env.BFF_POS_URL) ? DEFAULTS.bffPosUrl : env.BFF_POS_URL.trim(),
    bffPosTimeoutMs: enteroPositivo("BFF_POS_TIMEOUT_MS", env.BFF_POS_TIMEOUT_MS, DEFAULTS.bffPosTimeoutMs),
    bffAuditoriaUrl: estaVacio(env.BFF_AUDITORIA_URL) ? DEFAULTS.bffAuditoriaUrl : env.BFF_AUDITORIA_URL.trim(),
    bffAuditoriaTimeoutMs: enteroPositivo("BFF_AUDITORIA_TIMEOUT_MS", env.BFF_AUDITORIA_TIMEOUT_MS, DEFAULTS.bffAuditoriaTimeoutMs),
    rateLimitWindowMs: enteroPositivo("RATE_LIMIT_WINDOW_MS", env.RATE_LIMIT_WINDOW_MS, DEFAULTS.rateLimitWindowMs),
    rateLimitMax: enteroPositivo("RATE_LIMIT_MAX", env.RATE_LIMIT_MAX, DEFAULTS.rateLimitMax),
    // Contrato del Frontend servido en /docs y /openapi.yaml. Se lee desde
    // contracts/ (sin copia en el servicio, steering structure.md); en Docker
    // contracts/ se monta en /contracts.
    contratoFrontendPath: estaVacio(env.CONTRATO_FRONTEND_PATH)
      ? path.join(__dirname, "..", "..", "..", "..", "contracts", "spec0-frontend.yaml")
      : env.CONTRATO_FRONTEND_PATH.trim()
  };
}

module.exports = {
  crearGatewayConfig,
  DEFAULTS
};
