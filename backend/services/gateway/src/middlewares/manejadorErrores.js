const { ErrorGateway, noAutenticado, autorizacionNoDisponible, errorInterno } = require("../utils/errorGateway");

// Errores de jwks-rsa cuando no puede obtener las claves (Keycloak caido, etc.).
const ERRORES_JWKS = new Set(["JwksError", "JwksRateLimitError"]);
const CODIGOS_RED = new Set(["ECONNREFUSED", "ENOTFOUND", "ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "ECONNABORTED"]);

function esErrorJwks(err) {
  return Boolean(err) && (ERRORES_JWKS.has(err.name) || CODIGOS_RED.has(err.code));
}

/**
 * Manejador central: ErrorRespuestaGateway { error: { code, message, reintentable } }
 * sin detalles tecnicos. El detalle de los 5xx queda solo en el log.
 */
function manejadorErrores(err, req, res, next) {
  let error;
  if (err instanceof ErrorGateway) {
    error = err;
  } else if (err && err.name === "UnauthorizedError") {
    // express-jwt: sin token, token malformado, firma invalida, expirado, iss/aud incorrectos.
    const conToken = err.code !== "credentials_required";
    res.setHeader("WWW-Authenticate", conToken ? 'Bearer error="invalid_token"' : "Bearer");
    error = noAutenticado();
  } else if (esErrorJwks(err)) {
    error = autorizacionNoDisponible();
  } else {
    error = errorInterno();
  }

  if (error.status >= 500) {
    console.error(`[Gateway Error] ${error.code}:`, err && err.message);
  }
  if (res.headersSent) {
    return res.end();
  }
  return res.status(error.status).json(error.toRespuesta());
}

module.exports = {
  manejadorErrores
};
