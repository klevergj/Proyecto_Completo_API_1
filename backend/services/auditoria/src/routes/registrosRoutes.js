const express = require("express");
const { validarRegistroAuditoria } = require("../middlewares/validarRegistroAuditoria");
const { crearValidarParametrosListado } = require("../middlewares/validarParametrosListado");
const { validarIdEvaluacion } = require("../middlewares/validarIdEvaluacion");

/**
 * Rutas de registros: solo cablean middlewares + controlador.
 * No existen rutas de modificacion ni borrado (registro inmutable, Req 1.7).
 *
 * @param {{ crear: Function, listar: Function, obtenerPorId: Function }} registrosController
 * @param {{ paginaTamanoDefecto: number, paginaTamanoMaximo: number }} paginacion
 */
function crearRegistrosRoutes(registrosController, paginacion) {
  const router = express.Router();

  router.post("/", validarRegistroAuditoria, registrosController.crear);
  router.get("/", crearValidarParametrosListado(paginacion), registrosController.listar);
  router.get("/:idEvaluacion", validarIdEvaluacion, registrosController.obtenerPorId);

  return router;
}

module.exports = {
  crearRegistrosRoutes
};
