/**
 * Puerto (interfaz) del repositorio de historial interno.
 *
 * El resto del servicio (controladores, app) depende SOLO de esta interfaz,
 * nunca de PostgreSQL. Cualquier implementacion (postgresHistorialRepository,
 * o una en memoria para pruebas) debe cumplirla.
 *
 * @typedef {Object} HistorialRepository
 * @property {(identificacion: string) => Promise<import("../models/clienteHistorial")|null>} buscarPorIdentificacion
 *   Devuelve el ClienteHistorial o null si el cliente no tiene historial
 *   (cliente nuevo). Los fallos de infraestructura se propagan como error.
 */

const METODOS_HISTORIAL_REPOSITORY = Object.freeze(["buscarPorIdentificacion"]);

/**
 * Verifica en tiempo de ejecucion que `implementacion` cumpla la interfaz
 * (JavaScript no tiene `implements`). Se invoca al inyectar el repositorio.
 *
 * @param {*} implementacion
 * @returns {HistorialRepository} la misma implementacion
 * @throws {TypeError} si falta algun metodo
 */
function asegurarHistorialRepository(implementacion) {
  for (const metodo of METODOS_HISTORIAL_REPOSITORY) {
    if (!implementacion || typeof implementacion[metodo] !== "function") {
      throw new TypeError(`HistorialRepository invalido: falta el metodo "${metodo}"`);
    }
  }
  return implementacion;
}

module.exports = {
  METODOS_HISTORIAL_REPOSITORY,
  asegurarHistorialRepository
};
