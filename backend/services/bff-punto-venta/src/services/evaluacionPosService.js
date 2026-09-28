const ResultadoEvaluacion = require("../models/resultadoEvaluacion");
const { asegurarResultadoEvaluacionRepository } = require("../repositories/resultadoEvaluacionRepository.interface");
const { traducirErrorCore } = require("../utils/errorBff");

/**
 * Caso de uso del BFF Punto de Venta. Orquesta el cliente del core y el
 * repositorio de resultados; no conoce HTTP de entrada ni el formato de caja.
 *
 * @param {{ coreClient: { solicitarEvaluacion: Function, obtenerEvaluacionPorId: Function },
 *           resultadoRepository: import("../repositories/resultadoEvaluacionRepository.interface").ResultadoEvaluacionRepository }} deps
 */
function crearEvaluacionPosService({ coreClient, resultadoRepository }) {
  const repositorio = asegurarResultadoEvaluacionRepository(resultadoRepository);

  /**
   * Evalua una SolicitudCore ya validada y guarda el resultado para reconsultas.
   * Una sola llamada al core, sin reintentos (RF-05 crit. 7).
   * @param {Object} solicitudCore
   * @returns {Promise<ResultadoEvaluacion>}
   */
  async function registrarEvaluacion(solicitudCore) {
    let decisionCore;
    try {
      decisionCore = await coreClient.solicitarEvaluacion(solicitudCore);
    } catch (error) {
      throw traducirErrorCore(error, { operacion: "crear" });
    }

    const resultado = ResultadoEvaluacion.desdeDecisionCore(decisionCore);
    await repositorio.guardar(resultado);
    return resultado;
  }

  /**
   * Cache-Aside (RF-04): primero el repositorio; si no esta, el core, y se guarda.
   * @param {string} idEvaluacion UUID ya validado
   * @returns {Promise<ResultadoEvaluacion>}
   */
  async function consultarEstado(idEvaluacion) {
    const guardado = await repositorio.buscarPorId(idEvaluacion);
    if (guardado) {
      return guardado;
    }

    let decisionCore;
    try {
      decisionCore = await coreClient.obtenerEvaluacionPorId(idEvaluacion);
    } catch (error) {
      throw traducirErrorCore(error, { operacion: "consultar" });
    }

    const resultado = ResultadoEvaluacion.desdeDecisionCore(decisionCore);
    await repositorio.guardar(resultado);
    return resultado;
  }

  return { registrarEvaluacion, consultarEstado };
}

module.exports = {
  crearEvaluacionPosService
};
