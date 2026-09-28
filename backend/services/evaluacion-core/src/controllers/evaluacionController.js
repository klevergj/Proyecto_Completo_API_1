/**
 * Controlador de evaluaciones: HTTP <-> evaluacionCreditoService. Sin logica de negocio.
 * @param {{ evaluacionCreditoService: { evaluar: Function, obtenerPorId: Function } }} deps
 */
function crearEvaluacionController({ evaluacionCreditoService }) {
  /** POST /evaluar (requiere validarSolicitudCore) */
  async function evaluar(req, res, next) {
    try {
      return res.status(200).json(await evaluacionCreditoService.evaluar(req.body));
    } catch (error) {
      return next(error);
    }
  }

  /** GET /evaluaciones/:id */
  async function obtenerPorId(req, res, next) {
    try {
      return res.status(200).json(await evaluacionCreditoService.obtenerPorId(req.params.id));
    } catch (error) {
      return next(error);
    }
  }

  return { evaluar, obtenerPorId };
}

module.exports = {
  crearEvaluacionController
};
