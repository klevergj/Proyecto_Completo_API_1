const { validarSolicitudEvaluacionPos } = require("../dtos/solicitudEvaluacionPosDto");
const { solicitudInvalida } = require("../utils/errorBff");

/**
 * Middleware: valida el cuerpo contra SolicitudEvaluacionPos antes de llegar al
 * controlador (cero llamadas al core con datos invalidos, RF-01 crit. 3-7) y
 * deja la SolicitudCore traducida en `req.solicitudCore`.
 */
function validarSolicitudEvaluacion(req, res, next) {
  const validacion = validarSolicitudEvaluacionPos(req.body);
  if (!validacion.ok) {
    return next(solicitudInvalida(validacion.errores.join(". ")));
  }
  req.solicitudCore = validacion.valor;
  return next();
}

module.exports = {
  validarSolicitudEvaluacion
};
