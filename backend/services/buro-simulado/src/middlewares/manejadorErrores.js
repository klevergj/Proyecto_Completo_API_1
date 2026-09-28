const { ErrorBuro } = require("../utils/errorBuro");

/**
 * Manejador central de errores (Req. 7.1): toda falla sale como
 * { error: { message, code } }. Los ErrorBuro conservan su estado y codigo; el
 * resto usa err.status (o 500) y el codigo BURO_SIMULATOR_ERROR.
 */
function manejadorErrores(err, req, res, next) {
  if (err instanceof ErrorBuro) {
    return res.status(err.status).json({ error: { message: err.message, code: err.code } });
  }

  console.error("[Buro Simulado Error]:", err.message);
  return res.status(err.status || 500).json({
    error: {
      message: err.message || "Error interno en Simulador de Buro",
      code: "BURO_SIMULATOR_ERROR"
    }
  });
}

module.exports = {
  manejadorErrores
};
