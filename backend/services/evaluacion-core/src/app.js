const express = require("express");
const cors = require("cors");
const { crearEvaluacionCreditoService } = require("./services/evaluacionCreditoService");
const { crearEvaluacionController } = require("./controllers/evaluacionController");
const { crearEvaluacionRoutes } = require("./routes/evaluacionRoutes");
const { manejadorErrores } = require("./middlewares/manejadorErrores");

/**
 * Construye la aplicacion a partir de sus dependencias (inyeccion): cualquier
 * implementacion de HistorialClienteRepository y DatosBuroRepository, y el
 * publicador de auditoria.
 *
 * @param {{ historialClienteRepository: Object, datosBuroRepository: Object,
 *           auditoriaPublisher: Object, generarId?: Function, ahora?: Function }} deps
 */
function crearApp(deps) {
  const app = express();
  const evaluacionController = crearEvaluacionController({
    evaluacionCreditoService: crearEvaluacionCreditoService(deps)
  });

  app.use(cors());
  app.use(express.json());

  app.get("/health", (req, res) => {
    res.status(200).json({ status: "UP", service: "evaluacion-core", timestamp: new Date().toISOString() });
  });

  app.use("/", crearEvaluacionRoutes(evaluacionController));
  app.use(manejadorErrores);

  return app;
}

module.exports = {
  crearApp
};
