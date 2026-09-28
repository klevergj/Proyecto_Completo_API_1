const express = require("express");
const { crearValidarParametrosListado } = require("../middlewares/validarParametrosListado");
const { validarIdEvaluacion } = require("../middlewares/validarIdEvaluacion");

/**
 * Rutas del panel de auditoria: solo cablean middlewares + controlador.
 * @param {{ listar: Function, obtenerDetalle: Function }} evaluacionesController
 * @param {{ paginaTamanoDefecto: number, paginaTamanoMaximo: number }} paginacion
 */
function crearEvaluacionesRoutes(evaluacionesController, paginacion) {
  const router = express.Router();

  router.get("/", crearValidarParametrosListado(paginacion), evaluacionesController.listar);
  router.get("/:id/detalle", validarIdEvaluacion, evaluacionesController.obtenerDetalle);

  return router;
}

module.exports = {
  crearEvaluacionesRoutes
};
