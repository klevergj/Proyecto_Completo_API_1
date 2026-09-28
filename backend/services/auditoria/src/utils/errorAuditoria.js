/**
 * Errores tipados del Servicio de Auditoria y clasificacion de fallos de MongoDB.
 * Todo error sale como { error: { code, message } } con textos FIJOS (Req 5.6).
 */

const MENSAJES = Object.freeze({
  REGISTRO_INVALIDO: "El registro de auditoria no es valido",
  PARAMETRO_INVALIDO: "Los parametros de la consulta no son validos",
  REGISTRO_NO_ENCONTRADO: "No existe un registro de auditoria para esa evaluacion",
  REGISTRO_DUPLICADO: "Ya existe un registro de auditoria para esa evaluacion",
  ALMACEN_NO_DISPONIBLE: "El almacen de auditoria no esta disponible temporalmente",
  ERROR_INTERNO: "Error interno en el Servicio de Auditoria"
});

// Clases de error del driver de MongoDB que indican indisponibilidad.
const ERRORES_DISPONIBILIDAD = new Set([
  "MongoServerSelectionError",
  "MongoNetworkError",
  "MongoNetworkTimeoutError",
  "MongoNotConnectedError",
  "MongoTopologyClosedError"
]);
const CODIGO_MAX_TIME_MS_EXPIRED = 50;

class ErrorAuditoria extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "ErrorAuditoria";
    this.status = status;
    this.code = code;
  }

  toRespuesta() {
    return { error: { code: this.code, message: this.message } };
  }
}

const registroInvalido = (detalle) => new ErrorAuditoria(400, "REGISTRO_INVALIDO", detalle || MENSAJES.REGISTRO_INVALIDO);
const parametroInvalido = (detalle) => new ErrorAuditoria(400, "PARAMETRO_INVALIDO", detalle || MENSAJES.PARAMETRO_INVALIDO);
const registroNoEncontrado = () => new ErrorAuditoria(404, "REGISTRO_NO_ENCONTRADO", MENSAJES.REGISTRO_NO_ENCONTRADO);
const registroDuplicado = () => new ErrorAuditoria(409, "REGISTRO_DUPLICADO", MENSAJES.REGISTRO_DUPLICADO);

function esErrorDeDisponibilidad(error) {
  if (!error) return false;
  return ERRORES_DISPONIBILIDAD.has(error.name) || error.code === CODIGO_MAX_TIME_MS_EXPIRED;
}

/**
 * @param {*} error
 * @returns {ErrorAuditoria} el mismo si ya es ErrorAuditoria; 503 o 500 en otro caso
 */
function clasificarErrorAlmacen(error) {
  if (error instanceof ErrorAuditoria) return error;
  if (esErrorDeDisponibilidad(error)) {
    return new ErrorAuditoria(503, "ALMACEN_NO_DISPONIBLE", MENSAJES.ALMACEN_NO_DISPONIBLE);
  }
  return new ErrorAuditoria(500, "ERROR_INTERNO", MENSAJES.ERROR_INTERNO);
}

module.exports = {
  ErrorAuditoria,
  MENSAJES,
  registroInvalido,
  parametroInvalido,
  registroNoEncontrado,
  registroDuplicado,
  clasificarErrorAlmacen
};
