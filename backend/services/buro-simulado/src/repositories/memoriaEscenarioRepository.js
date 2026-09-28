const { normalizarEscenario, ESCENARIO_POR_DEFECTO } = require("../models/escenario");
const { asegurarEscenarioRepository } = require("./escenarioRepository.interface");

/**
 * Implementacion en memoria de EscenarioRepository (una instancia por proceso).
 *
 * Inicializacion total (Req. 5.5, 5.6): si `escenarioInicial` normalizado es
 * valido se usa; si es ausente o invalido se usa NORMAL.
 *
 * @param {{ escenarioInicial?: string }} [opciones]
 * @returns {import("./escenarioRepository.interface").EscenarioRepository}
 */
function crearMemoriaEscenarioRepository({ escenarioInicial } = {}) {
  let escenarioActual = normalizarEscenario(escenarioInicial) || ESCENARIO_POR_DEFECTO;

  async function obtener() {
    return escenarioActual;
  }

  async function guardar(escenario) {
    escenarioActual = escenario;
  }

  return asegurarEscenarioRepository({ obtener, guardar });
}

module.exports = {
  crearMemoriaEscenarioRepository
};
