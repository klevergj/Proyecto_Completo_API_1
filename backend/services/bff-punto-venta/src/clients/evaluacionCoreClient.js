const axios = require("axios");
const bffConfig = require("../config/bffConfig");

const coreHttpClient = axios.create({
  baseURL: bffConfig.coreUrl,
  timeout: bffConfig.coreTimeoutMs,
  headers: {
    "Content-Type": "application/json"
  }
});

/**
 * Envia la SolicitudCore a evaluacion-core (POST /evaluar).
 * Sin reintentos: la evaluacion no es idempotente (RF-05 crit. 7). Los errores
 * de axios se propagan tal cual; los traduce el servicio.
 * @param {Object} solicitudCore
 * @returns {Promise<Object>} DecisionCore
 */
async function solicitarEvaluacion(solicitudCore) {
  const response = await coreHttpClient.post("/evaluar", solicitudCore);
  return response.data;
}

/**
 * Obtiene una evaluacion previa de evaluacion-core (GET /evaluaciones/:id).
 * @param {string} id
 * @returns {Promise<Object>} DecisionCore
 */
async function obtenerEvaluacionPorId(id) {
  const response = await coreHttpClient.get(`/evaluaciones/${encodeURIComponent(id)}`);
  return response.data;
}

module.exports = {
  solicitarEvaluacion,
  obtenerEvaluacionPorId
};
