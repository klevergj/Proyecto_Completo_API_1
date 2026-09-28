/**
 * Modelo de dominio del escenario de operacion del buro simulado.
 * Escenarios validos: NORMAL, LATENCIA_ALTA, CAIDO.
 */

const ESCENARIOS_VALIDOS = Object.freeze(["NORMAL", "LATENCIA_ALTA", "CAIDO"]);
const ESCENARIO_POR_DEFECTO = "NORMAL";

/**
 * Indica si un valor, tras normalizarse a mayusculas, pertenece al conjunto
 * de escenarios validos.
 * @param {*} valor
 * @returns {boolean}
 */
function esEscenarioValido(valor) {
  return typeof valor === "string" && ESCENARIOS_VALIDOS.includes(valor.toUpperCase());
}

/**
 * Normaliza a mayusculas un escenario valido.
 * @param {*} valor
 * @returns {string|null} el escenario normalizado, o null si es ausente/invalido
 */
function normalizarEscenario(valor) {
  return esEscenarioValido(valor) ? valor.toUpperCase() : null;
}

module.exports = {
  ESCENARIOS_VALIDOS,
  ESCENARIO_POR_DEFECTO,
  esEscenarioValido,
  normalizarEscenario
};
