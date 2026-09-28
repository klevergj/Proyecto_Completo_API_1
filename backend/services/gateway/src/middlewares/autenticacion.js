const { expressjwt } = require("express-jwt");
const jwksRsa = require("jwks-rsa");

/**
 * Autenticacion OAuth2 (Req 1): valida el Token_Acceso emitido por Keycloak
 * (flujo client_credentials) con express-jwt + jwks-rsa (steering tech.md).
 *
 * - Solo RS256: descarta `alg: none` y la confusion de algoritmos con HS256.
 * - Verifica firma (JWKS), iss, aud y exp.
 * - JWKS con cache (10 min) y limite de consultas: validar no requiere red por peticion.
 * - El payload verificado queda en req.auth.
 *
 * @param {{ jwtIssuer: string, jwtAudience: string, jwksUri: string, jwksTimeoutMs: number,
 *           obtenerClaveFirma?: Function }} opciones  `obtenerClaveFirma` es inyectable en pruebas.
 */
function crearAutenticacion({ jwtIssuer, jwtAudience, jwksUri, jwksTimeoutMs, obtenerClaveFirma }) {
  const secret =
    obtenerClaveFirma ||
    jwksRsa.expressJwtSecret({
      jwksUri,
      cache: true,
      cacheMaxAge: 10 * 60 * 1000,
      rateLimit: true,
      jwksRequestsPerMinute: 10,
      timeout: jwksTimeoutMs
    });

  return expressjwt({
    secret,
    algorithms: ["RS256"],
    issuer: jwtIssuer,
    audience: jwtAudience,
    requestProperty: "auth"
  });
}

module.exports = {
  crearAutenticacion
};
