/**
 * Puerto (interfaz) hacia el historial interno del cliente (Repositorio
 * Interno, spec6). El caso de uso depende SOLO de esta interfaz: nunca conoce
 * el esquema de la base ni HTTP (steering tech.md, Repository/Adapter).
 *
 * @typedef {Object} HistorialClienteRepository
 * @property {(identificacion: string) => Promise<import("../models/historialCliente")|null>} buscarPorIdentificacion
 *   Devuelve el HistorialCliente, o null si el cliente no tiene historial
 *   (cliente nuevo). Cualquier otro fallo se propaga (dato imprescindible).
 */

const METODOS_HISTORIAL_CLIENTE_REPOSITORY = Object.freeze(["buscarPorIdentificacion"]);

/**
 * Verifica en tiempo de ejecucion que `implementacion` cumpla la interfaz.
 * @param {*} implementacion
 * @returns {HistorialClienteRepository}
 * @throws {TypeError} si falta algun metodo
 */
function asegurarHistorialClienteRepository(implementacion) {
  for (const metodo of METODOS_HISTORIAL_CLIENTE_REPOSITORY) {
    if (!implementacion || typeof implementacion[metodo] !== "function") {
      throw new TypeError(`HistorialClienteRepository invalido: falta el metodo "${metodo}"`);
    }
  }
  return implementacion;
}

module.exports = {
  METODOS_HISTORIAL_CLIENTE_REPOSITORY,
  asegurarHistorialClienteRepository
};
