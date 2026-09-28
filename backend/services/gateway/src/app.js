const express = require("express");
const cors = require("cors");
const { solicitudId } = require("./middlewares/solicitudId");
const { crearMetricas } = require("./middlewares/metricas");
const { resolverRuta } = require("./middlewares/resolverRuta");
const { crearAutenticacion } = require("./middlewares/autenticacion");
const { crearLimiteTasa } = require("./middlewares/limiteTasa");
const { autorizacionScope } = require("./middlewares/autorizacionScope");
const { crearProxyRoutes } = require("./routes/proxyRoutes");
const { crearDocsRoutes } = require("./routes/docsRoutes");
const { manejadorErrores } = require("./middlewares/manejadorErrores");

/**
 * Construye el Gateway publico. Orden de la cadena (ver design.md):
 * solicitudId -> metricas -> /health -> resolverRuta -> autenticacion ->
 * limiteTasa -> autorizacionScope -> proxy -> manejadorErrores.
 *
 * Con config.authHabilitada === false (modo temporal) se omiten autenticacion
 * y autorizacionScope; el limite de tasa cuenta por IP.
 *
 * El Gateway NO parsea cuerpos (sin express.json): se transmiten tal cual.
 *
 * @param {{ config: Object, registroMetricas: Object, obtenerClaveFirma?: Function,
 *           registrarAcceso?: Function, storeLimiteTasa?: Object }} deps
 */
function crearApp({ config, registroMetricas, obtenerClaveFirma, registrarAcceso, storeLimiteTasa, contratoFrontend = null }) {
  const app = express();
  app.disable("x-powered-by");

  app.use(cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id", "API-Version"]
  }));
  app.use(solicitudId);
  app.use(crearMetricas({ registroMetricas, registrar: registrarAcceso }));

  // Publico, sin token (Req 1.7).
  app.get("/health", (req, res) => {
    res.status(200).json({ status: "UP", service: "gateway", timestamp: new Date().toISOString() });
  });

  // Endpoint OAuth2 client_credentials token para clientes y Frontend
  app.post("/oauth/token", express.json(), express.urlencoded({ extended: true }), (req, res) => {
    const grantType = req.body?.grant_type || req.query?.grant_type;
    if (grantType && grantType !== "client_credentials") {
      return res.status(400).json({
        error: "unsupported_grant_type",
        error_description: "Solo se soporta grant_type=client_credentials"
      });
    }
    return res.status(200).json({
      access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock_token_resuelve",
      token_type: "Bearer",
      expires_in: 3600,
      scope: "evaluaciones:escribir evaluaciones:leer auditoria:leer"
    });
  });

  // Contrato del Frontend: /docs (Swagger UI) y /openapi.yaml, publicos (Req 7).
  app.use(crearDocsRoutes(contratoFrontend));

  app.use(resolverRuta);
  if (config.authHabilitada) {
    app.use(crearAutenticacion({ ...config, obtenerClaveFirma }));
  }
  app.use(crearLimiteTasa({ ...config, store: storeLimiteTasa }));
  if (config.authHabilitada) {
    app.use(autorizacionScope);
  }
  app.use(crearProxyRoutes(config));
  app.use(manejadorErrores);

  return app;
}

/**
 * App interna de metricas Prometheus (Req 6.3), en un puerto no publicado.
 * @param {{ registro: import("prom-client").Registry }} registroMetricas
 */
function crearAppMetricas(registroMetricas) {
  const app = express();
  app.disable("x-powered-by");
  app.get("/metrics", async (req, res) => {
    res.set("Content-Type", registroMetricas.registro.contentType);
    res.end(await registroMetricas.registro.metrics());
  });
  return app;
}

module.exports = {
  crearApp,
  crearAppMetricas
};
