const { UUID_REGEX } = require("../dtos/registroAuditoriaDto");
const { parametroInvalido } = require("../utils/errorAuditoria");

/**
 * Middleware: `:idEvaluacion` debe ser UUID (Req 3.3); lo normaliza a minusculas.
 */
function validarIdEvaluacion(req, res, next) {
  const { idEvaluacion } = req.params;
  if (!UUID_REGEX.test(idEvaluacion)) {
    return next(parametroInvalido("idEvaluacion debe ser un UUID"));
  }
  req.idEvaluacion = idEvaluacion.toLowerCase();
  return next();
}

module.exports = {
  validarIdEvaluacion
};
