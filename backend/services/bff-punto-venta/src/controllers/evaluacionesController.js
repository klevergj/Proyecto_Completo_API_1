const { toResultadoPosDto } = require("../dtos/resultadoPosDto");

/**
 * Controlador de evaluaciones: traduce HTTP <-> caso de uso y arma el DTO de caja.
 * @param {{ evaluacionPosService: { registrarEvaluacion: Function, consultarEstado: Function } }} deps
 */
function crearEvaluacionesController({ evaluacionPosService }) {
  /**
   * POST /evaluaciones-credito
   * Requiere el middleware validarSolicitudEvaluacion (deja req.solicitudCore).
   */
  async function crear(req, res, next) {
    try {
      const resultado = await evaluacionPosService.registrarEvaluacion(req.solicitudCore);
      return res.status(200).json(toResultadoPosDto(resultado));
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /evaluaciones-credito/:id
   * Requiere el middleware validarIdEvaluacion.
   */
  async function obtenerEstado(req, res, next) {
    try {
      const resultado = await evaluacionPosService.consultarEstado(req.params.id);
      return res.status(200).json(toResultadoPosDto(resultado));
    } catch (error) {
      return next(error);
    }
  }

  return { crear, obtenerEstado };
}

module.exports = {
  crearEvaluacionesController
};
