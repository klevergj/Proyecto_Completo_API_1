/**
 * Errores del BFF Auditoria y traduccion centralizada de los fallos del
 * Servicio de Auditoria (Req 4). Todo error sale como
 * { error: { code, message, reintentable } } con textos FIJOS.
 */

const MENSAJES = Object.freeze({
  PARAMETRO_INVALIDO: "Los parametros de la consulta no son validos",
  EVALUACION_NO_ENCONTRADA: "No encontramos esa evaluacion en auditoria",
  AUDITORIA_TIMEOUT: "La consulta esta tardando mas de lo normal. Intenta nuevamente.",
  SERVICIO_NO_DISPONIBLE: "El servicio de auditoria no esta disponible. Intenta nuevamente en unos minutos.",
  ERROR_AUDITORIA: "No pudimos obtener la informacion de auditoria. Intenta nuevamente.",
  ERROR_INTERNO: "Ocurrio un error inesperado. Intenta nuevamente."
});

const CODIGOS_TIMEOUT = new Set(["ECONNABORTED", "ETIMEDOUT"]);

class ErrorBffAuditoria extends Error {
  constructor(status, code, message, reintentable) {
    super(message);
    this.name = "ErrorBffAuditoria";
    this.status = status;
    this.code = code;
    this.reintentable = reintentable;
  }

  toRespuesta() {
    return { error: { code: this.code, message: this.message, reintentable: this.reintentable } };
  }
}

const parametroInvalido = (detalle) =>
  new ErrorBffAuditoria(400, "PARAMETRO_INVALIDO", detalle || MENSAJES.PARAMETRO_INVALIDO, false);
const evaluacionNoEncontrada = () =>
  new ErrorBffAuditoria(404, "EVALUACION_NO_ENCONTRADA", MENSAJES.EVALUACION_NO_ENCONTRADA, false);
const errorAuditoria = () => new ErrorBffAuditoria(502, "ERROR_AUDITORIA", MENSAJES.ERROR_AUDITORIA, true);
const errorInterno = () => new ErrorBffAuditoria(500, "ERROR_INTERNO", MENSAJES.ERROR_INTERNO, true);

/**
 * Traduce un error del cliente HTTP del Servicio de Auditoria (tabla del diseño).
 * @param {*} error
 * @returns {ErrorBffAuditoria}
 */
function traducirErrorAuditoria(error) {
  if (error instanceof ErrorBffAuditoria) return error;

  const code = error && error.code;
  const status = error && error.response && error.response.status;

  if (CODIGOS_TIMEOUT.has(code)) {
    return new ErrorBffAuditoria(504, "AUDITORIA_TIMEOUT", MENSAJES.AUDITORIA_TIMEOUT, true);
  }
  if (typeof status !== "number") {
    // Sin respuesta HTTP: no alcanzable (o un error local no previsto).
    return error && error.request
      ? new ErrorBffAuditoria(503, "SERVICIO_NO_DISPONIBLE", MENSAJES.SERVICIO_NO_DISPONIBLE, true)
      : errorInterno();
  }
  if (status === 400) return parametroInvalido();
  if (status === 404) return evaluacionNoEncontrada();
  if (status === 503) return new ErrorBffAuditoria(503, "SERVICIO_NO_DISPONIBLE", MENSAJES.SERVICIO_NO_DISPONIBLE, true);
  return errorAuditoria();
}

module.exports = {
  ErrorBffAuditoria,
  MENSAJES,
  parametroInvalido,
  evaluacionNoEncontrada,
  errorAuditoria,
  errorInterno,
  traducirErrorAuditoria
};
