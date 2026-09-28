const { asegurarEscenarioRepository } = require("../repositories/escenarioRepository.interface");
const { calcularScoreDeterministico } = require("../utils/scoringDeterministico");
const { servicioNoDisponible } = require("../utils/errorBuro");

/**
 * Caso de uso: consultar el score segun el escenario activo.
 *   - CAIDO: 503 inmediato, sin retraso (Req. 4.1).
 *   - LATENCIA_ALTA: espera `latenciaMs` y responde los mismos valores que NORMAL (Req. 3).
 *   - NORMAL: responde de inmediato.
 *
 * @param {{ escenarioRepository: Object, latenciaMs: number, esperar?: (ms: number) => Promise<void> }} deps
 */
function crearScoreService({
  escenarioRepository,
  latenciaMs,
  esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
}) {
  const repositorio = asegurarEscenarioRepository(escenarioRepository);

  /**
   * @param {string} identificacion ya validada
   * @returns {Promise<{ calculo: Object, escenario: string }>}
   */
  async function consultarScore(identificacion) {
    const escenario = await repositorio.obtener();

    if (escenario === "CAIDO") {
      throw servicioNoDisponible();
    }
    if (escenario === "LATENCIA_ALTA") {
      await esperar(latenciaMs);
    }

    return { calculo: calcularScoreDeterministico(identificacion), escenario };
  }

  return { consultarScore };
}

module.exports = {
  crearScoreService
};
