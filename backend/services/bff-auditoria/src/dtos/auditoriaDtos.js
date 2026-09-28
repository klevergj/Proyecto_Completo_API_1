/**
 * DTOs de salida del BFF Auditoria (Spec 3 v1.1.0).
 */

/**
 * ResumenAuditoria: elemento liviano del listado (Req 2.4). Sin motivo,
 * reglas, score ni datos del cliente.
 * @param {import("../models/evaluacionAuditada")} e
 */
function toResumenAuditoriaDto(e) {
  return {
    idEvaluacion: e.idEvaluacion,
    fecha: e.fecha,
    decision: e.decision,
    tiendaId: e.tiendaId,
    consultaBuroRealizada: e.consultaBuroRealizada
  };
}

/**
 * DetalleAuditoria: vista completa para el analista (Req 3.2-3.3). Siempre
 * las 12 claves; opcionales no registrados en null.
 * @param {import("../models/evaluacionAuditada")} e
 */
function toDetalleAuditoriaDto(e) {
  return {
    ...toResumenAuditoriaDto(e),
    identificacion: e.identificacion,
    montoSolicitado: e.montoSolicitado,
    plazoMeses: e.plazoMeses,
    motivo: e.motivo,
    scoreBuro: e.scoreBuro,
    reglasAplicadas: [...e.reglasAplicadas],
    registradoEn: e.registradoEn
  };
}

/**
 * Cantidad de paginas: 0 si no hay registros; si no, ceil(total / size) (Req 2.3).
 */
function calcularTotalPaginas(total, size) {
  return total === 0 ? 0 : Math.ceil(total / size);
}

/**
 * PaginaResumenAuditoria.
 * @param {{ total: number, page: number, size: number, items: import("../models/evaluacionAuditada")[] }} pagina
 */
function toPaginaResumenAuditoriaDto({ total, page, size, items }) {
  return {
    total,
    page,
    size,
    totalPaginas: calcularTotalPaginas(total, size),
    items: items.map(toResumenAuditoriaDto)
  };
}

module.exports = {
  toResumenAuditoriaDto,
  toDetalleAuditoriaDto,
  calcularTotalPaginas,
  toPaginaResumenAuditoriaDto
};
