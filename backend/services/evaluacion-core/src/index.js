require("dotenv").config();
const coreConfig = require("./config/coreConfig");
const { crearHttpHistorialClienteRepository } = require("./repositories/httpHistorialClienteRepository");
const { crearHttpDatosBuroRepository } = require("./repositories/httpDatosBuroRepository");
const { crearAuditoriaPublisher } = require("./clients/auditoriaPublisher");
const { crearApp } = require("./app");

// Composicion: aqui se eligen las implementaciones concretas.
const app = crearApp({
  historialClienteRepository: crearHttpHistorialClienteRepository({
    baseURL: coreConfig.repositorioInternoUrl,
    timeoutMs: coreConfig.repositorioInternoTimeoutMs
  }),
  datosBuroRepository: crearHttpDatosBuroRepository({
    baseURL: coreConfig.buroUrl,
    timeoutMs: coreConfig.buroTimeoutMs,
    breakerOptions: coreConfig.circuitBreaker
  }),
  auditoriaPublisher: crearAuditoriaPublisher({
    baseURL: coreConfig.auditoriaUrl,
    timeoutMs: coreConfig.auditoriaTimeoutMs
  })
});

if (process.env.NODE_ENV !== "test") {
  app.listen(coreConfig.port, () => {
    console.log(`[Evaluacion Core] Servidor escuchando en el puerto ${coreConfig.port}`);
  });
}

module.exports = app;
