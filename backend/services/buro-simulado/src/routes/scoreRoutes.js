const express = require("express");
const { validarIdentificacion } = require("../middlewares/validarIdentificacion");

/**
 * Rutas de score: solo cablean middleware + controlador.
 * @param {{ obtenerScore: Function }} scoreController
 */
function crearScoreRoutes(scoreController) {
  const router = express.Router();

  router.get("/:identificacion", validarIdentificacion, scoreController.obtenerScore);

  return router;
}

module.exports = {
  crearScoreRoutes
};
