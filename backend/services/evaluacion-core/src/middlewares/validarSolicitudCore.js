const { identificacionInvalida, solicitudInvalida } = require("../utils/errorCore");

/**
 * Middleware: validacion temprana de SolicitudCore contra el contrato spec4
 * ("Entrada invalida en SolicitudCore -> validacion temprana en la ruta; se
 * responde 400 antes de tocar el dominio", design.md del core).
 *
 * Valida FORMA (tipos y rangos del contrato), no reglas de negocio.
 */
function validarSolicitudCore(req, res, next) {
  const body = req.body;
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return next(solicitudInvalida("El cuerpo de la solicitud debe ser un objeto JSON"));
  }
  if (typeof body.identificacion !== "string" || body.identificacion.trim() === "") {
    return next(identificacionInvalida());
  }
  if (typeof body.montoSolicitado !== "number" || !Number.isFinite(body.montoSolicitado) || body.montoSolicitado <= 0) {
    return next(solicitudInvalida("montoSolicitado debe ser un numero mayor que 0"));
  }
  if (!Number.isInteger(body.plazoMeses) || body.plazoMeses <= 0) {
    return next(solicitudInvalida("plazoMeses debe ser un entero mayor que 0"));
  }
  if (body.tiendaId !== undefined && typeof body.tiendaId !== "string") {
    return next(solicitudInvalida("tiendaId debe ser una cadena"));
  }
  return next();
}

module.exports = {
  validarSolicitudCore
};
