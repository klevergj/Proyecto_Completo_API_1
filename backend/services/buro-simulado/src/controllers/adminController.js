/**
 * Controlador de administracion de escenarios: HTTP <-> escenarioService.
 * @param {{ escenarioService: { consultar: Function, cambiar: Function } }} deps
 */
function crearAdminController({ escenarioService }) {
  /** GET /admin/escenario (Req. 5.4) */
  async function obtenerEscenario(req, res, next) {
    try {
      return res.status(200).json({ escenario: await escenarioService.consultar() });
    } catch (error) {
      return next(error);
    }
  }

  /** POST /admin/escenario (Req. 5.1-5.3) */
  async function cambiarEscenario(req, res, next) {
    try {
      const escenario = await escenarioService.cambiar(req.body && req.body.escenario);
      console.log(`[Buro Simulado] Escenario cambiado a: ${escenario}`);
      return res.status(200).json({ mensaje: "Escenario actualizado exitosamente", escenario });
    } catch (error) {
      return next(error);
    }
  }

  return { obtenerEscenario, cambiarEscenario };
}

module.exports = {
  crearAdminController
};
