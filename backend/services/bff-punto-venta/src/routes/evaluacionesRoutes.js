const express = require("express");
const { validarSolicitudEvaluacion } = require("../middlewares/validarSolicitudEvaluacion");
const { validarIdEvaluacion } = require("../middlewares/validarIdEvaluacion");

/**
 * Rutas de evaluaciones: solo cablean middlewares + controlador.
 * @param {{ crear: Function, obtenerEstado: Function }} evaluacionesController
 */
function crearEvaluacionesRoutes(evaluacionesController) {
  const router = express.Router();

  router.post("/", validarSolicitudEvaluacion, evaluacionesController.crear);
  router.get("/:id", validarIdEvaluacion, evaluacionesController.obtenerEstado);

  return router;
}

module.exports = {
  crearEvaluacionesRoutes
};
