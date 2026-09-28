const { identificacionInvalida } = require("../utils/errorRepositorio");

/**
 * Formato aceptado de identificacion: 1 a 20 caracteres alfanumericos o guion.
 * Cubre cedula (10), RUC (13) e identificaciones alfanumericas; el limite de 20
 * coincide con la columna VARCHAR(20) de clientes_historial.
 */
const IDENTIFICACION_REGEX = /^[0-9A-Za-z-]{1,20}$/;

/**
 * Normaliza y valida una identificacion (RF-01 crit. 5).
 * @param {*} valor
 * @returns {string|null} la identificacion sin espacios alrededor, o null si es invalida
 */
function normalizarIdentificacion(valor) {
  if (typeof valor !== "string") {
    return null;
  }
  const normalizada = valor.trim();
  return IDENTIFICACION_REGEX.test(normalizada) ? normalizada : null;
}

/**
 * Middleware: valida `req.params.identificacion` antes de llegar al
 * controlador (sin viaje a la base con valores imposibles) y deja la version
 * normalizada en `req.identificacion`.
 */
function validarIdentificacion(req, res, next) {
  const identificacion = normalizarIdentificacion(req.params.identificacion);
  if (identificacion === null) {
    return next(identificacionInvalida());
  }
  req.identificacion = identificacion;
  return next();
}

module.exports = {
  IDENTIFICACION_REGEX,
  normalizarIdentificacion,
  validarIdentificacion
};
