const express = require("express");
const { validarSolicitudCore } = require("../middlewares/validarSolicitudCore");

/**
 * Rutas de evaluacion: solo cablean middlewares + controlador.
 * @param {{ evaluar: Function, obtenerPorId: Function }} evaluacionController
 */
function crearEvaluacionRoutes(evaluacionController) {
  const router = express.Router();

  router.post("/evaluar", validarSolicitudCore, evaluacionController.evaluar);
  router.get("/evaluaciones/:id", evaluacionController.obtenerPorId);

  return router;
}

module.exports = {
  crearEvaluacionRoutes
};
