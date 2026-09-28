const RegistroAuditoria = require("../models/registroAuditoria");
const { toRegistroAuditoriaDto } = require("../dtos/registroAuditoriaDto");
const { toPaginaRegistrosDto } = require("../dtos/listadoRegistrosDto");
const { registroNoEncontrado } = require("../utils/errorAuditoria");

/**
 * Controlador de registros de auditoria. Depende de la INTERFAZ
 * RegistroAuditoriaRepository, no de MongoDB.
 *
 * @param {{ registroRepository: import("../repositories/registroAuditoriaRepository.interface").RegistroAuditoriaRepository,
 *           ahora?: () => Date }} deps
 */
function crearRegistrosController({ registroRepository, ahora = () => new Date() }) {
  /** POST /registros (requiere validarRegistroAuditoria) — 201 */
  async function crear(req, res, next) {
    try {
      const registro = new RegistroAuditoria({ ...req.registro, registradoEn: ahora() });
      await registroRepository.guardar(registro);
      return res.status(201).json(toRegistroAuditoriaDto(registro));
    } catch (error) {
      return next(error);
    }
  }

  /** GET /registros (requiere validarParametrosListado) — 200 pagina */
  async function listar(req, res, next) {
    try {
      const resultado = await registroRepository.buscar(req.listado);
      return res.status(200).json(toPaginaRegistrosDto(resultado, req.listado));
    } catch (error) {
      return next(error);
    }
  }

  /** GET /registros/:idEvaluacion (requiere validarIdEvaluacion) — 200 / 404 */
  async function obtenerPorId(req, res, next) {
    try {
      const registro = await registroRepository.buscarPorId(req.idEvaluacion);
      if (registro === null) {
        throw registroNoEncontrado();
      }
      return res.status(200).json(toRegistroAuditoriaDto(registro));
    } catch (error) {
      return next(error);
    }
  }

  return { crear, listar, obtenerPorId };
}

module.exports = {
  crearRegistrosController
};
