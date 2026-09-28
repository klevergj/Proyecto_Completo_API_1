require("dotenv").config();
const buroConfig = require("./config/buroConfig");
const { crearMemoriaEscenarioRepository } = require("./repositories/memoriaEscenarioRepository");
const { cargarContratoOpenApi } = require("./utils/contratoOpenApi");
const { crearApp } = require("./app");

// Composicion: aqui se eligen las implementaciones concretas.
const escenarioRepository = crearMemoriaEscenarioRepository({ escenarioInicial: buroConfig.escenarioInicial });

const app = crearApp({
  escenarioRepository,
  latenciaMs: buroConfig.latenciaMs,
  contrato: cargarContratoOpenApi(buroConfig.contratoOpenApiPath)
});

if (process.env.NODE_ENV !== "test") {
  app.listen(buroConfig.port, () => {
    console.log(`[Buro Simulado] Servidor escuchando en el puerto ${buroConfig.port}`);
    console.log(`[Buro Simulado] Swagger UI disponible en http://localhost:${buroConfig.port}/docs`);
  });
}

module.exports = app;
// Expuesto para pruebas: permite fijar el escenario activo sin pasar por HTTP.
module.exports.escenarioRepository = escenarioRepository;
