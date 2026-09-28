const { asegurarEscenarioRepository } = require("../repositories/escenarioRepository.interface");
const { normalizarEscenario } = require("../models/escenario");
const { escenarioInvalido } = require("../utils/errorBuro");

/**
 * Caso de uso: administrar el escenario activo (Req. 5).
 * @param {{ escenarioRepository: Object }} deps
 */
function crearEscenarioService({ escenarioRepository }) {
  const repositorio = asegurarEscenarioRepository(escenarioRepository);

  async function consultar() {
    return repositorio.obtener();
  }

  /**
   * Normaliza y cambia el escenario. Si es ausente o invalido lanza 400
   * INVALID_SCENARIO sin modificar el estado previo (Req. 5.3).
   * @param {*} valor
   * @returns {Promise<string>} el escenario normalizado
   */
  async function cambiar(valor) {
    const escenario = normalizarEscenario(valor);
    if (escenario === null) {
      throw escenarioInvalido();
    }
    await repositorio.guardar(escenario);
    return escenario;
  }

  return { consultar, cambiar };
}

module.exports = {
  crearEscenarioService
};
