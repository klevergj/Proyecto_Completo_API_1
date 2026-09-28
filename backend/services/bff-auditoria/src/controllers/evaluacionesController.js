const { toPaginaResumenAuditoriaDto, toDetalleAuditoriaDto } = require("../dtos/auditoriaDtos");
const { evaluacionNoEncontrada } = require("../utils/errorBffAuditoria");

/**
 * Controlador del panel de auditoria. Depende de la INTERFAZ
 * RegistroAuditoriaRepository; no contiene logica de negocio.
 *
 * @param {{ registroRepository: import("../repositories/registroAuditoriaRepository.interface").RegistroAuditoriaRepository }} deps
 */
function crearEvaluacionesController({ registroRepository }) {
  /** GET /evaluaciones (requiere validarParametrosListado) */
  async function listar(req, res, next) {
    try {
      const pagina = await registroRepository.buscar(req.listado);
      return res.status(200).json(toPaginaResumenAuditoriaDto(pagina));
    } catch (error) {
      return next(error);
    }
  }

  /** GET /evaluaciones/:id/detalle (requiere validarIdEvaluacion) */
  async function obtenerDetalle(req, res, next) {
    try {
      const evaluacion = await registroRepository.buscarPorId(req.params.id);
      if (evaluacion === null) {
        throw evaluacionNoEncontrada();
      }
      return res.status(200).json(toDetalleAuditoriaDto(evaluacion));
    } catch (error) {
      return next(error);
    }
  }

  return { listar, obtenerDetalle };
}

module.exports = {
  crearEvaluacionesController
};
