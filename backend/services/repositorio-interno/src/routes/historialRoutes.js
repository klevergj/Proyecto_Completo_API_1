const express = require("express");
const { validarIdentificacion } = require("../middlewares/validarIdentificacion");

/**
 * Rutas del historial interno: solo cablean middleware + controlador.
 * @param {{ obtenerHistorial: Function }} historialController
 */
function crearHistorialRoutes(historialController) {
  const router = express.Router();

  router.get("/clientes/:identificacion/historial", validarIdentificacion, historialController.obtenerHistorial);

  return router;
}

module.exports = {
  crearHistorialRoutes
};
