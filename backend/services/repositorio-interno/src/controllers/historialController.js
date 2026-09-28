const { toHistorialClienteDto } = require("../dtos/historialClienteDto");
const { clienteNoEncontrado } = require("../utils/errorRepositorio");

/**
 * Controlador del historial interno. Depende de la INTERFAZ HistorialRepository,
 * no de PostgreSQL.
 *
 * @param {{ historialRepository: import("../repositories/historialRepository.interface").HistorialRepository,
 *           ahora?: () => Date }} deps
 */
function crearHistorialController({ historialRepository, ahora = () => new Date() }) {
  /**
   * GET /clientes/:identificacion/historial
   * Requiere el middleware validarIdentificacion (deja req.identificacion).
   * 200 HistorialCliente | 404 cliente nuevo (sin historial).
   */
  async function obtenerHistorial(req, res, next) {
    try {
      const cliente = await historialRepository.buscarPorIdentificacion(req.identificacion);
      if (cliente === null) {
        // Unico camino hacia 404: el cliente no tiene registro (RF-02).
        throw clienteNoEncontrado();
      }
      return res.status(200).json(toHistorialClienteDto(cliente, ahora()));
    } catch (error) {
      return next(error);
    }
  }

  return { obtenerHistorial };
}

module.exports = {
  crearHistorialController
};
