require("dotenv").config();
const bffAuditoriaConfig = require("./config/bffAuditoriaConfig");
const { crearHttpRegistroAuditoriaRepository } = require("./repositories/httpRegistroAuditoriaRepository");
const { crearApp } = require("./app");

// Composicion: aqui se elige la implementacion concreta del repositorio.
const app = crearApp({
  registroRepository: crearHttpRegistroAuditoriaRepository({
    baseURL: bffAuditoriaConfig.auditoriaServiceUrl,
    timeoutMs: bffAuditoriaConfig.auditoriaTimeoutMs
  }),
  config: bffAuditoriaConfig
});

if (process.env.NODE_ENV !== "test") {
  app.listen(bffAuditoriaConfig.port, () => {
    console.log(`[BFF Auditoria] Servidor escuchando en el puerto ${bffAuditoriaConfig.port}`);
  });
}

module.exports = app;
