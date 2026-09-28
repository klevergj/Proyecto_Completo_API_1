/**
 * Error tipado de evaluacion-core. El manejador central lo responde como
 * { error: { message, code } } con su estado HTTP (ErrorRespuesta, spec4).
 */
class ErrorCore extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "ErrorCore";
    this.status = status;
    this.code = code;
  }
}

function identificacionInvalida() {
  return new ErrorCore(400, "INVALID_IDENTIFICACION", "La identificacion es obligatoria y no puede estar vacia");
}

function solicitudInvalida(message) {
  return new ErrorCore(400, "INVALID_REQUEST", message);
}

module.exports = {
  ErrorCore,
  identificacionInvalida,
  solicitudInvalida
};
