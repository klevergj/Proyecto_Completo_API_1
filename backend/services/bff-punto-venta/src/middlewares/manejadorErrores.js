const { ErrorBff, solicitudInvalida, errorInterno } = require("../utils/errorBff");

/**
 * Manejador central de errores: toda falla sale como ErrorRespuestaPos
 * { error: { code, message, reintentable } } sin filtrar detalles tecnicos (RF-05).
 */
function manejadorErrores(err, req, res, next) {
  if (err instanceof ErrorBff) {
    if (err.status >= 500) {
      console.error(`[BFF POS Error] ${err.code}`);
    }
    return res.status(err.status).json(err.toRespuesta());
  }

  // JSON mal formado en el cuerpo (express.json).
  if (err && err.type === "entity.parse.failed") {
    const errorValidacion = solicitudInvalida("El cuerpo de la solicitud debe ser un objeto JSON");
    return res.status(errorValidacion.status).json(errorValidacion.toRespuesta());
  }

  console.error("[BFF POS Error] Error no controlado:", err);
  const errorNoControlado = errorInterno();
  return res.status(errorNoControlado.status).json(errorNoControlado.toRespuesta());
}

module.exports = {
  manejadorErrores
};
