/**
 * Modelo de errores del BFF Punto de Venta y traduccion centralizada de los
 * fallos del core (RF-05).
 *
 * Todo error que llega al frontend tiene la forma ErrorRespuestaPos:
 *   { error: { code, message, reintentable } }
 * Los `message` son textos fijos en lenguaje humano: NUNCA se copian el
 * `message` de axios ni el cuerpo de la respuesta del core (RF-05 crit. 5).
 */

const MENSAJES = Object.freeze({
  ID_EVALUACION_INVALIDO: "El identificador de evaluación no es válido",
  IDENTIFICACION_INVALIDA: "La identificación ingresada no es válida",
  SOLICITUD_INVALIDA: "Los datos de la solicitud no son válidos",
  EVALUACION_NO_ENCONTRADA: "No encontramos esa evaluación",
  EVALUACION_TIMEOUT:
    "La evaluación está tardando más de lo normal. Intenta nuevamente en unos segundos.",
  SERVICIO_NO_DISPONIBLE:
    "El servicio de evaluación no está disponible. Intenta nuevamente en unos minutos.",
  ERROR_EVALUACION: "No pudimos completar la evaluación. Intenta nuevamente.",
  ERROR_INTERNO: "Ocurrió un error inesperado. Intenta nuevamente."
});

const CODIGOS_TIMEOUT = new Set(["ECONNABORTED", "ETIMEDOUT"]);
const CODIGOS_RED = new Set(["ECONNREFUSED", "ENOTFOUND", "ECONNRESET", "EAI_AGAIN", "EHOSTUNREACH", "ENETUNREACH"]);

class ErrorBff extends Error {
  /**
   * @param {number} status estado HTTP
   * @param {string} code codigo estable
   * @param {string} message texto humano para el frontend
   * @param {boolean} reintentable si la UI puede ofrecer reintentar
   */
  constructor(status, code, message, reintentable) {
    super(message);
    this.name = "ErrorBff";
    this.status = status;
    this.code = code;
    this.reintentable = reintentable;
  }

  toRespuesta() {
    return {
      error: {
        code: this.code,
        message: this.message,
        reintentable: this.reintentable
      }
    };
  }
}

function solicitudInvalida(message = MENSAJES.SOLICITUD_INVALIDA) {
  return new ErrorBff(400, "SOLICITUD_INVALIDA", message, false);
}

function idEvaluacionInvalido() {
  return new ErrorBff(400, "ID_EVALUACION_INVALIDO", MENSAJES.ID_EVALUACION_INVALIDO, false);
}

function errorEvaluacion() {
  return new ErrorBff(502, "ERROR_EVALUACION", MENSAJES.ERROR_EVALUACION, true);
}

function errorInterno() {
  return new ErrorBff(500, "ERROR_INTERNO", MENSAJES.ERROR_INTERNO, true);
}

/**
 * Traduce un error del cliente HTTP del core a un ErrorBff (tabla del diseño).
 * @param {*} error error lanzado por axios (o ya un ErrorBff)
 * @param {{ operacion: "crear"|"consultar" }} contexto
 * @returns {ErrorBff}
 */
function traducirErrorCore(error, { operacion } = {}) {
  if (error instanceof ErrorBff) {
    return error;
  }

  const code = error && error.code;
  const status = error && error.response && error.response.status;

  if (CODIGOS_TIMEOUT.has(code)) {
    return new ErrorBff(504, "EVALUACION_TIMEOUT", MENSAJES.EVALUACION_TIMEOUT, true);
  }

  if (typeof status !== "number") {
    // Sin respuesta HTTP: el core no es alcanzable (conexion rechazada, DNS, etc.).
    if (CODIGOS_RED.has(code) || (error && error.request)) {
      return new ErrorBff(503, "SERVICIO_NO_DISPONIBLE", MENSAJES.SERVICIO_NO_DISPONIBLE, true);
    }
    return errorInterno();
  }

  if (status === 400) {
    const cuerpo = error.response.data;
    const codeCore = cuerpo && cuerpo.error && cuerpo.error.code;
    return solicitudInvalida(
      codeCore === "INVALID_IDENTIFICACION" ? MENSAJES.IDENTIFICACION_INVALIDA : MENSAJES.SOLICITUD_INVALIDA
    );
  }

  if (status === 404 && operacion === "consultar") {
    return new ErrorBff(404, "EVALUACION_NO_ENCONTRADA", MENSAJES.EVALUACION_NO_ENCONTRADA, false);
  }

  // 5xx y cualquier otro estado inesperado del core.
  return errorEvaluacion();
}

module.exports = {
  ErrorBff,
  MENSAJES,
  solicitudInvalida,
  idEvaluacionInvalido,
  errorEvaluacion,
  errorInterno,
  traducirErrorCore
};
