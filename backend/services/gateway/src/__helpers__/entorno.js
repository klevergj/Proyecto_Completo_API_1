/**
 * Entorno de pruebas del Gateway: BFFs de eco que devuelven lo recibido y
 * cuentan invocaciones, mas una fabrica de apps con JWKS local.
 */
const http = require("http");
const { crearApp } = require("../app");
const { crearRegistroMetricas } = require("../utils/registroMetricas");
const { ISSUER, AUDIENCE } = require("./jwt");

/**
 * BFF de eco: responde 200 con { metodo, ruta, cabeceras, cuerpo } salvo que
 * se configure `estado` o `demoraMs`.
 */
function levantarBffEco({ estado = 200, demoraMs = 0 } = {}) {
  const recibidas = [];
  const servidor = http.createServer((req, res) => {
    let cuerpo = "";
    req.on("data", (c) => (cuerpo += c));
    req.on("end", () => {
      const recibida = { metodo: req.method, ruta: req.url, cabeceras: req.headers, cuerpo };
      recibidas.push(recibida);
      setTimeout(() => {
        res.statusCode = estado;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(recibida));
      }, demoraMs);
    });
  });
  return new Promise((resolve) => {
    servidor.listen(0, () => {
      resolve({
        url: `http://localhost:${servidor.address().port}`,
        recibidas,
        cerrar: () => new Promise((r) => {
          servidor.closeAllConnections();
          servidor.close(() => r());
        })
      });
    });
  });
}

/**
 * App del Gateway para pruebas.
 */
function crearAppPrueba({ jwksUri, bffPosUrl, bffAuditoriaUrl, rateLimitMax = 1000, bffPosTimeoutMs = 2000, bffAuditoriaTimeoutMs = 2000, registroMetricas = crearRegistroMetricas(), authHabilitada = true }) {
  const config = {
    authHabilitada,
    jwtIssuer: ISSUER,
    jwtAudience: AUDIENCE,
    jwksUri,
    jwksTimeoutMs: 1000,
    bffPosUrl,
    bffPosTimeoutMs,
    bffAuditoriaUrl,
    bffAuditoriaTimeoutMs,
    rateLimitWindowMs: 60000,
    rateLimitMax
  };
  return { app: crearApp({ config, registroMetricas, registrarAcceso: () => {} }), registroMetricas };
}

module.exports = {
  levantarBffEco,
  crearAppPrueba
};
