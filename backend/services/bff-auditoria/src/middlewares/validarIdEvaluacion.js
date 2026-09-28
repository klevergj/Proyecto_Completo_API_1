const { parametroInvalido } = require("../utils/errorBffAuditoria");

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Middleware: `:id` debe ser UUID (Req 3.4); sin llamar al Servicio de Auditoria.
 */
function validarIdEvaluacion(req, res, next) {
  if (!UUID_REGEX.test(req.params.id)) {
    return next(parametroInvalido("id debe ser un UUID"));
  }
  return next();
}

module.exports = {
  UUID_REGEX,
  validarIdEvaluacion
};
