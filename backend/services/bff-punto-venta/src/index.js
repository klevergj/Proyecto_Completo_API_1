require("dotenv").config();
const bffConfig = require("./config/bffConfig");
const evaluacionCoreClient = require("./clients/evaluacionCoreClient");
const { crearMemoriaResultadoEvaluacionRepository } = require("./repositories/memoriaResultadoEvaluacionRepository");
const { crearApp } = require("./app");

const PORT = process.env.PORT || 8081;

// Composicion: aqui se eligen las implementaciones concretas.
const app = crearApp({
  coreClient: evaluacionCoreClient,
  resultadoRepository: crearMemoriaResultadoEvaluacionRepository({
    ttlMs: bffConfig.cacheTtlMs,
    maxEntradas: bffConfig.cacheMaxEntradas
  })
});

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`[BFF Punto de Venta] Servidor escuchando en el puerto ${PORT}`);
  });
}

module.exports = app;
