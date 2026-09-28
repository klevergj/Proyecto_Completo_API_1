require("dotenv").config();
const { crearGatewayConfig } = require("./config/gatewayConfig");
const { crearRegistroMetricas } = require("./utils/registroMetricas");
const { cargarContratoFrontend } = require("./utils/contratoFrontend");
const { crearApp, crearAppMetricas } = require("./app");

// Composicion: configuracion (falla sin OAuth2 si esta habilitada), registro
// de metricas, contrato del Frontend y dos apps.
const config = crearGatewayConfig();
const registroMetricas = crearRegistroMetricas();
const app = crearApp({
  config,
  registroMetricas,
  contratoFrontend: cargarContratoFrontend(config.contratoFrontendPath)
});
const appMetricas = crearAppMetricas(registroMetricas);

if (process.env.NODE_ENV !== "test") {
  if (!config.authHabilitada) {
    console.warn(
      "[Gateway] ATENCION: AUTH_HABILITADA=false. Las peticiones NO se autentican ni se verifican scopes " +
        "(modo temporal hasta integrar el Frontend con tokens). El limite de tasa se aplica por IP."
    );
  }
  app.listen(config.port, () => {
    console.log(`[Gateway] Servidor publico escuchando en el puerto ${config.port} (contrato /v1)`);
  });
  appMetricas.listen(config.metricsPort, () => {
    console.log(`[Gateway] Metricas Prometheus en el puerto interno ${config.metricsPort} (/metrics)`);
  });
}

module.exports = app;
