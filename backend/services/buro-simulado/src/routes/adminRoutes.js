const express = require("express");

/**
 * Rutas de administracion de escenarios: solo cablean el controlador.
 * @param {{ obtenerEscenario: Function, cambiarEscenario: Function }} adminController
 */
function crearAdminRoutes(adminController) {
  const router = express.Router();

  router.get("/escenario", adminController.obtenerEscenario);
  router.post("/escenario", adminController.cambiarEscenario);

  return router;
}

module.exports = {
  crearAdminRoutes
};
