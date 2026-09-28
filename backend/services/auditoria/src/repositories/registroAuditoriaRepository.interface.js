/**
 * Puerto (interfaz) del repositorio de registros de auditoria.
 *
 * Controladores dependen SOLO de esta interfaz. Implementaciones:
 *   - mongoRegistroAuditoriaRepository (produccion, steering tech.md)
 *   - memoriaRegistroAuditoriaRepository (pruebas, misma semantica)
 *
 * @typedef {Object} FiltrosListado
 * @property {string} [estado]      decision exacta
 * @property {string} [fechaDesde]  YYYY-MM-DD, dia UTC inclusive
 * @property {string} [fechaHasta]  YYYY-MM-DD, dia UTC inclusive
 * @property {string} [tiendaId]
 *
 * @typedef {Object} RegistroAuditoriaRepository
 * @property {() => Promise<void>} inicializar
 *   Prepara el almacen (indices). Idempotente.
 * @property {(registro: import("../models/registroAuditoria")) => Promise<void>} guardar
 *   Persiste el registro. Lanza ErrorAuditoria 409 REGISTRO_DUPLICADO si el idEvaluacion ya existe.
 * @property {(idEvaluacion: string) => Promise<import("../models/registroAuditoria")|null>} buscarPorId
 * @property {(criterios: { filtros: FiltrosListado, page: number, size: number }) => Promise<{ total: number, items: import("../models/registroAuditoria")[] }>} buscar
 *   Orden fecha descendente, idEvaluacion ascendente. `page` base 0.
 */

const METODOS_REGISTRO_AUDITORIA_REPOSITORY = Object.freeze(["inicializar", "guardar", "buscarPorId", "buscar"]);

/**
 * Verifica en tiempo de ejecucion que `implementacion` cumpla la interfaz.
 * @param {*} implementacion
 * @returns {RegistroAuditoriaRepository}
 * @throws {TypeError} si falta algun metodo
 */
function asegurarRegistroAuditoriaRepository(implementacion) {
  for (const metodo of METODOS_REGISTRO_AUDITORIA_REPOSITORY) {
    if (!implementacion || typeof implementacion[metodo] !== "function") {
      throw new TypeError(`RegistroAuditoriaRepository invalido: falta el metodo "${metodo}"`);
    }
  }
  return implementacion;
}

module.exports = {
  METODOS_REGISTRO_AUDITORIA_REPOSITORY,
  asegurarRegistroAuditoriaRepository
};
