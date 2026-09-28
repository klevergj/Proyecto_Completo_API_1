/**
 * Puerto (interfaz) de lectura de evaluaciones auditadas para el panel.
 *
 * El controlador depende SOLO de esta interfaz. Implementacion actual:
 * httpRegistroAuditoriaRepository (Servicio de Auditoria, Spec 7 v1.1.0).
 *
 * @typedef {Object} RegistroAuditoriaRepository
 * @property {(listado: { estado?: string, fechaDesde?: string, fechaHasta?: string, tiendaId?: string, page: number, size: number })
 *   => Promise<{ total: number, page: number, size: number, items: import("../models/evaluacionAuditada")[] }>} buscar
 * @property {(idEvaluacion: string) => Promise<import("../models/evaluacionAuditada")|null>} buscarPorId
 *   null si la evaluacion no existe en auditoria.
 */

const METODOS_REGISTRO_AUDITORIA_REPOSITORY = Object.freeze(["buscar", "buscarPorId"]);

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
