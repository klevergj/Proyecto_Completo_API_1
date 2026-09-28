/**
 * Puerto (interfaz) hacia los datos del buro externo. El caso de uso depende
 * SOLO de esta interfaz; la resiliencia (Circuit Breaker + fallback) es
 * responsabilidad de la implementacion.
 *
 * @typedef {Object} DatosBuroRepository
 * @property {(identificacion: string) => Promise<import("../models/datosBuro")>} obtenerPorIdentificacion
 *   Devuelve DatosBuro normalizado. Ante fallo, timeout o breaker abierto
 *   devuelve DatosBuro.indisponible() y NUNCA lanza (RF-07). Solo un error del
 *   cliente (4xx, entrada invalida) se propaga.
 */

const METODOS_DATOS_BURO_REPOSITORY = Object.freeze(["obtenerPorIdentificacion"]);

/**
 * Verifica en tiempo de ejecucion que `implementacion` cumpla la interfaz.
 * @param {*} implementacion
 * @returns {DatosBuroRepository}
 * @throws {TypeError} si falta algun metodo
 */
function asegurarDatosBuroRepository(implementacion) {
  for (const metodo of METODOS_DATOS_BURO_REPOSITORY) {
    if (!implementacion || typeof implementacion[metodo] !== "function") {
      throw new TypeError(`DatosBuroRepository invalido: falta el metodo "${metodo}"`);
    }
  }
  return implementacion;
}

module.exports = {
  METODOS_DATOS_BURO_REPOSITORY,
  asegurarDatosBuroRepository
};
