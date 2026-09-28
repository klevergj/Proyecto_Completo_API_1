const { asegurarRegistroAuditoriaRepository } = require("./registroAuditoriaRepository.interface");
const { registroDuplicado } = require("../utils/errorAuditoria");
const { inicioDiaUtc, inicioDiaSiguienteUtc } = require("../utils/fechas");

/**
 * Implementacion en memoria de RegistroAuditoriaRepository, con la MISMA
 * semantica que la de MongoDB (duplicados, filtros, orden y paginacion).
 * Se usa en pruebas; produccion usa mongoRegistroAuditoriaRepository.
 *
 * @returns {import("./registroAuditoriaRepository.interface").RegistroAuditoriaRepository}
 */
function crearMemoriaRegistroAuditoriaRepository() {
  const registros = new Map();

  async function inicializar() {}

  async function guardar(registro) {
    if (registros.has(registro.idEvaluacion)) {
      throw registroDuplicado();
    }
    registros.set(registro.idEvaluacion, registro);
  }

  async function buscarPorId(idEvaluacion) {
    return registros.get(idEvaluacion) || null;
  }

  async function buscar({ filtros = {}, page, size }) {
    const desde = filtros.fechaDesde ? inicioDiaUtc(filtros.fechaDesde).getTime() : -Infinity;
    const hasta = filtros.fechaHasta ? inicioDiaSiguienteUtc(filtros.fechaHasta).getTime() : Infinity;

    const coinciden = [...registros.values()]
      .filter(
        (r) =>
          (!filtros.estado || r.decision === filtros.estado) &&
          (!filtros.tiendaId || r.tiendaId === filtros.tiendaId) &&
          r.fecha.getTime() >= desde &&
          r.fecha.getTime() < hasta
      )
      .sort((a, b) => b.fecha - a.fecha || (a.idEvaluacion < b.idEvaluacion ? -1 : a.idEvaluacion > b.idEvaluacion ? 1 : 0));

    return {
      total: coinciden.length,
      items: coinciden.slice(page * size, page * size + size)
    };
  }

  return asegurarRegistroAuditoriaRepository({ inicializar, guardar, buscarPorId, buscar });
}

module.exports = {
  crearMemoriaRegistroAuditoriaRepository
};
