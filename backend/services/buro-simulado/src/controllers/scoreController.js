const { toScoreResponseDto } = require("../dtos/scoreResponseDto");

/**
 * Controlador de score: HTTP <-> scoreService.
 * @param {{ scoreService: { consultarScore: Function }, ahora?: () => Date }} deps
 */
function crearScoreController({ scoreService, ahora = () => new Date() }) {
  /**
   * GET /score/:identificacion
   * Requiere el middleware validarIdentificacion.
   */
  async function obtenerScore(req, res, next) {
    try {
      const { identificacion } = req.params;
      const { calculo, escenario } = await scoreService.consultarScore(identificacion);
      return res.status(200).json(toScoreResponseDto({ identificacion, calculo, escenario, fecha: ahora() }));
    } catch (error) {
      return next(error);
    }
  }

  return { obtenerScore };
}

module.exports = {
  crearScoreController
};
