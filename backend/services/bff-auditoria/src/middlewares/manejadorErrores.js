const { ErrorBffAuditoria, traducirErrorAuditoria } = require("../utils/errorBffAuditoria");

/**
 * Manejador central: ErrorRespuestaAuditoria { error: { code, message, reintentable } }
 * sin mensajes de axios ni el cuerpo del Servicio de Auditoria (Req 4.5). El
 * detalle tecnico de los 5xx queda solo en el log.
 */
function manejadorErrores(err, req, res, next) {
  const error = err instanceof ErrorBffAuditoria ? err : traducirErrorAuditoria(err);
  if (error.status >= 500) {
    console.error(`[BFF Auditoria Error] ${error.code}:`, err && err.message);
  }
  return res.status(error.status).json(error.toRespuesta());
}

module.exports = {
  manejadorErrores
};
