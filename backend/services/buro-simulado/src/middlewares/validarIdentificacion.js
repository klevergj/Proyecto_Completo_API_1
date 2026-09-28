const { identificacionInvalida } = require("../utils/errorBuro");

/**
 * Middleware: rechaza con 400 INVALID_IDENTIFICACION una identificacion vacia
 * o solo espacios (Req. 2.5), antes de leer el escenario.
 */
function validarIdentificacion(req, res, next) {
  if (req.params.identificacion.trim() === "") {
    return next(identificacionInvalida());
  }
  return next();
}

module.exports = {
  validarIdentificacion
};
