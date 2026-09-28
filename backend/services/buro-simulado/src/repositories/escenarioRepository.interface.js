/**
 * Puerto (interfaz) del repositorio del escenario activo del buro simulado.
 *
 * Controladores y servicios dependen SOLO de esta interfaz. La implementacion
 * actual es en memoria (memoriaEscenarioRepository): el escenario no se
 * persiste entre reinicios (Req. 5.5-5.6).
 *
 * @typedef {Object} EscenarioRepository
 * @property {() => Promise<string>} obtener
 *   Devuelve el escenario activo (siempre uno valido y normalizado).
 * @property {(escenario: string) => Promise<void>} guardar
 *   Reemplaza el escenario activo. Recibe un escenario ya normalizado y valido.
 */

const METODOS_ESCENARIO_REPOSITORY = Object.freeze(["obtener", "guardar"]);

/**
 * Verifica en tiempo de ejecucion que `implementacion` cumpla la interfaz.
 * @param {*} implementacion
 * @returns {EscenarioRepository}
 * @throws {TypeError} si falta algun metodo
 */
function asegurarEscenarioRepository(implementacion) {
  for (const metodo of METODOS_ESCENARIO_REPOSITORY) {
    if (!implementacion || typeof implementacion[metodo] !== "function") {
      throw new TypeError(`EscenarioRepository invalido: falta el metodo "${metodo}"`);
    }
  }
  return implementacion;
}

module.exports = {
  METODOS_ESCENARIO_REPOSITORY,
  asegurarEscenarioRepository
};
