/**
 * Errores propios del Gateway: { error: { code, message, reintentable } },
 * la misma forma que usan los BFFs. Textos fijos, sin detalles tecnicos.
 */

class ErrorGateway extends Error {
  constructor(status, code, message, reintentable) {
    super(message);
    this.name = "ErrorGateway";
    this.status = status;
    this.code = code;
    this.reintentable = reintentable;
  }

  toRespuesta() {
    return { error: { code: this.code, message: this.message, reintentable: this.reintentable } };
  }
}

const noAutenticado = () => new ErrorGateway(401, "NO_AUTENTICADO", "Se requiere un token de acceso valido", false);
const scopeInsuficiente = (scope) =>
  new ErrorGateway(403, "SCOPE_INSUFICIENTE", `El token no tiene el scope requerido: ${scope}`, false);
const rutaNoEncontrada = () => new ErrorGateway(404, "RUTA_NO_ENCONTRADA", "La ruta solicitada no existe en esta version del API", false);
const limiteTasaExcedido = () =>
  new ErrorGateway(429, "LIMITE_TASA_EXCEDIDO", "Se excedio el limite de peticiones. Intenta nuevamente en unos segundos.", true);
const bffNoDisponible = () =>
  new ErrorGateway(502, "BFF_NO_DISPONIBLE", "El servicio no esta disponible. Intenta nuevamente en unos minutos.", true);
const bffTimeout = () => new ErrorGateway(504, "BFF_TIMEOUT", "El servicio esta tardando mas de lo normal. Intenta nuevamente.", true);
const autorizacionNoDisponible = () =>
  new ErrorGateway(503, "AUTORIZACION_NO_DISPONIBLE", "No se pudo validar el token en este momento. Intenta nuevamente.", true);
const errorInterno = () => new ErrorGateway(500, "ERROR_INTERNO", "Ocurrio un error inesperado. Intenta nuevamente.", true);

module.exports = {
  ErrorGateway,
  noAutenticado,
  scopeInsuficiente,
  rutaNoEncontrada,
  limiteTasaExcedido,
  bffNoDisponible,
  bffTimeout,
  autorizacionNoDisponible,
  errorInterno
};
