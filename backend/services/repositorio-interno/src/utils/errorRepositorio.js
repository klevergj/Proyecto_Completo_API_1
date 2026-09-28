/**
 * Modelo de errores del Repositorio Interno y clasificacion centralizada de los
 * fallos de la base de datos (Req 4).
 *
 * Todo error sale como ErrorRespuesta { error: { code, message } } con textos
 * FIJOS: nunca se copian mensajes del driver, SQL, tablas ni hosts (Req 4 crit. 4).
 */

const MENSAJES = Object.freeze({
  IDENTIFICACION_INVALIDA: "La identificación debe tener entre 1 y 20 caracteres alfanuméricos o guiones",
  CLIENTE_NO_ENCONTRADO: "El cliente no tiene historial interno",
  REPOSITORIO_NO_DISPONIBLE: "El repositorio interno no está disponible temporalmente",
  ERROR_INTERNO: "Error interno en el repositorio"
});

// Errores de red de Node al conectar con PostgreSQL.
const CODIGOS_RED = new Set(["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "ECONNRESET", "EAI_AGAIN", "EHOSTUNREACH", "ENETUNREACH", "EPIPE"]);

// SQLSTATE de disponibilidad: servidor cerrandose, demasiadas conexiones,
// consulta cancelada por statement_timeout.
const SQLSTATE_NO_DISPONIBLE = new Set(["57P01", "57P02", "57P03", "53300", "57014"]);

// Mensajes con los que node-pg reporta sus propios timeouts y cortes de conexion.
const MENSAJES_NO_DISPONIBLE = [
  /timeout exceeded when trying to connect/i,
  /query read timeout/i,
  /connection terminated/i
];

class ErrorRepositorio extends Error {
  /**
   * @param {number} status estado HTTP
   * @param {string} code codigo estable
   * @param {string} message texto sin detalles tecnicos
   */
  constructor(status, code, message) {
    super(message);
    this.name = "ErrorRepositorio";
    this.status = status;
    this.code = code;
  }

  toRespuesta() {
    return { error: { code: this.code, message: this.message } };
  }
}

function identificacionInvalida() {
  return new ErrorRepositorio(400, "IDENTIFICACION_INVALIDA", MENSAJES.IDENTIFICACION_INVALIDA);
}

// El 404 no incluye la identificacion consultada: es un dato personal (RF-02 crit. 3).
function clienteNoEncontrado() {
  return new ErrorRepositorio(404, "CLIENTE_NO_ENCONTRADO", MENSAJES.CLIENTE_NO_ENCONTRADO);
}

function esErrorDeDisponibilidad(error) {
  if (!error) return false;
  const code = typeof error.code === "string" ? error.code : "";
  if (CODIGOS_RED.has(code) || SQLSTATE_NO_DISPONIBLE.has(code) || code.startsWith("08")) {
    return true;
  }
  const mensaje = typeof error.message === "string" ? error.message : "";
  return MENSAJES_NO_DISPONIBLE.some((patron) => patron.test(mensaje));
}

/**
 * Clasifica un error de base de datos (o cualquier error no previsto).
 * @param {*} error
 * @returns {ErrorRepositorio} 503 REPOSITORIO_NO_DISPONIBLE o 500 ERROR_INTERNO
 */
function clasificarErrorBaseDatos(error) {
  if (error instanceof ErrorRepositorio) {
    return error;
  }
  if (esErrorDeDisponibilidad(error)) {
    return new ErrorRepositorio(503, "REPOSITORIO_NO_DISPONIBLE", MENSAJES.REPOSITORIO_NO_DISPONIBLE);
  }
  return new ErrorRepositorio(500, "ERROR_INTERNO", MENSAJES.ERROR_INTERNO);
}

module.exports = {
  ErrorRepositorio,
  MENSAJES,
  identificacionInvalida,
  clienteNoEncontrado,
  clasificarErrorBaseDatos
};
