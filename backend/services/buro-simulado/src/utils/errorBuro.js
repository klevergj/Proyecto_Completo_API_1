/**
 * Error tipado del Buro Simulado. El manejador central lo responde como
 * { error: { message, code } } con su estado HTTP.
 */
class ErrorBuro extends Error {
  /**
   * @param {number} status estado HTTP
   * @param {string} code codigo estable
   * @param {string} message texto para el consumidor
   */
  constructor(status, code, message) {
    super(message);
    this.name = "ErrorBuro";
    this.status = status;
    this.code = code;
  }
}

function identificacionInvalida() {
  return new ErrorBuro(400, "INVALID_IDENTIFICACION", "La identificacion es obligatoria y no puede estar vacia");
}

function escenarioInvalido() {
  return new ErrorBuro(400, "INVALID_SCENARIO", "Escenario invalido. Permitidos: NORMAL, LATENCIA_ALTA, CAIDO");
}

function servicioNoDisponible() {
  return new ErrorBuro(
    503,
    "SERVICE_UNAVAILABLE",
    "Servicio de buro de credito no disponible temporalmente (Escenario CAIDO)"
  );
}

function contratoNoDisponible() {
  return new ErrorBuro(404, "BURO_OPENAPI_NOT_FOUND", "Contrato OpenAPI no disponible");
}

module.exports = {
  ErrorBuro,
  identificacionInvalida,
  escenarioInvalido,
  servicioNoDisponible,
  contratoNoDisponible
};
