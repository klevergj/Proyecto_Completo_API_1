const { ErrorRepositorio, clasificarErrorBaseDatos } = require("../utils/errorRepositorio");

/**
 * Manejador central de errores: responde ErrorRespuesta { error: { code, message } }
 * sin detalles del driver, SQL, tablas ni hosts (Req 4 crit. 4). El detalle
 * tecnico de los 5xx queda solo en el log.
 */
function manejadorErrores(err, req, res, next) {
  const error = err instanceof ErrorRepositorio ? err : clasificarErrorBaseDatos(err);
  if (error.status >= 500) {
    console.error(`[Repositorio Interno Error] ${error.code}:`, err && err.message);
  }
  res.status(error.status).json(error.toRespuesta());
}

module.exports = {
  manejadorErrores
};
