const express = require("express");
const cors = require("cors");
const { crearEvaluacionPosService } = require("./services/evaluacionPosService");
const { crearEvaluacionesController } = require("./controllers/evaluacionesController");
const { crearEvaluacionesRoutes } = require("./routes/evaluacionesRoutes");
const { manejadorErrores } = require("./middlewares/manejadorErrores");

/**
 * Construye la aplicacion a partir de sus dependencias (inyeccion): cliente del
 * core y cualquier implementacion de ResultadoEvaluacionRepository.
 *
 * @param {{ coreClient: Object, resultadoRepository: Object }} deps
 */
function crearApp({ coreClient, resultadoRepository }) {
  const app = express();
  const evaluacionPosService = crearEvaluacionPosService({ coreClient, resultadoRepository });
  const evaluacionesController = crearEvaluacionesController({ evaluacionPosService });

  app.use(cors());
  app.use(express.json());

  app.get("/health", (req, res) => {
    res.status(200).json({ status: "UP", service: "bff-punto-venta", timestamp: new Date().toISOString() });
  });

  app.use("/evaluaciones-credito", crearEvaluacionesRoutes(evaluacionesController));
  app.use(manejadorErrores);

  return app;
}

module.exports = {
  crearApp
};
