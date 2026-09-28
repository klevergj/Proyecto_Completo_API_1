const axios = require("axios");
const EvaluacionAuditada = require("../models/evaluacionAuditada");
const { asegurarRegistroAuditoriaRepository } = require("./registroAuditoriaRepository.interface");
const { errorAuditoria } = require("../utils/errorBffAuditoria");

/**
 * Implementacion HTTP de RegistroAuditoriaRepository contra el Servicio de
 * Auditoria (Spec 7 v1.1.0), con timeout explicito (steering tech.md).
 *
 * @param {{ baseURL?: string, timeoutMs?: number, httpClient?: Object }} opciones
 *   `httpClient` permite inyectar un cliente axios en pruebas.
 * @returns {import("./registroAuditoriaRepository.interface").RegistroAuditoriaRepository}
 */
function crearHttpRegistroAuditoriaRepository({ baseURL, timeoutMs = 3000, httpClient } = {}) {
  const cliente =
    httpClient ||
    axios.create({
      baseURL,
      timeout: timeoutMs,
      headers: { "Content-Type": "application/json" }
    });

  async function buscar(listado) {
    const response = await cliente.get("/registros", { params: listado });
    const pagina = response.data;
    if (!pagina || typeof pagina.total !== "number" || !Array.isArray(pagina.items)) {
      throw errorAuditoria(); // respuesta fuera de Spec 7
    }
    return {
      total: pagina.total,
      page: listado.page,
      size: listado.size,
      items: pagina.items.map(EvaluacionAuditada.desdeRegistro)
    };
  }

  async function buscarPorId(idEvaluacion) {
    try {
      const response = await cliente.get(`/registros/${encodeURIComponent(idEvaluacion)}`);
      return EvaluacionAuditada.desdeRegistro(response.data);
    } catch (error) {
      if (error && error.response && error.response.status === 404) {
        return null;
      }
      throw error;
    }
  }

  return asegurarRegistroAuditoriaRepository({ buscar, buscarPorId });
}

module.exports = {
  crearHttpRegistroAuditoriaRepository
};
