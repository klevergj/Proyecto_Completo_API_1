const { idEvaluacionInvalido } = require("../utils/errorBff");

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Middleware: rechaza con 400 ID_EVALUACION_INVALIDO un `:id` sin formato UUID,
 * sin consultar el repositorio ni el core (RF-04 crit. 4).
 */
function validarIdEvaluacion(req, res, next) {
  if (!UUID_REGEX.test(req.params.id)) {
    return next(idEvaluacionInvalido());
  }
  return next();
}

module.exports = {
  UUID_REGEX,
  validarIdEvaluacion
};
