const { ErrorAuditoria, registroInvalido, clasificarErrorAlmacen } = require("../utils/errorAuditoria");

/**
 * Manejador central de errores: ErrorRespuesta { error: { code, message } }
 * sin mensajes del driver, cadenas de conexion ni hosts (Req 5.6). El detalle
 * tecnico de los 5xx queda solo en el log.
 */
function manejadorErrores(err, req, res, next) {
  // JSON mal formado en el cuerpo (express.json).
  if (err && err.type === "entity.parse.failed") {
    const error = registroInvalido("El cuerpo debe ser un objeto JSON");
    return res.status(error.status).json(error.toRespuesta());
  }

  const error = err instanceof ErrorAuditoria ? err : clasificarErrorAlmacen(err);
  if (error.status >= 500) {
    console.error(`[Auditoria Error] ${error.code}:`, err && err.message);
  }
  return res.status(error.status).json(error.toRespuesta());
}

module.exports = {
  manejadorErrores
};
