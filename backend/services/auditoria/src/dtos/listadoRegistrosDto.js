const { esFechaIsoValida } = require("../utils/fechas");
const RegistroAuditoria = require("../models/registroAuditoria");
const { toRegistroAuditoriaDto } = require("./registroAuditoriaDto");

const ENTERO_NO_NEGATIVO = /^\d+$/;

/**
 * Valida y normaliza los parametros de GET /registros (Req 2.7, 4.2-4.4).
 *
 * @param {Object} query req.query
 * @param {{ paginaTamanoDefecto: number, paginaTamanoMaximo: number }} paginacion
 * @returns {{ ok: true, valor: { filtros: Object, page: number, size: number } } | { ok: false, errores: string[] }}
 */
function validarParametrosListado(query = {}, { paginaTamanoDefecto, paginaTamanoMaximo }) {
  const errores = [];
  const filtros = {};

  if (query.estado !== undefined) {
    if (RegistroAuditoria.DECISIONES.includes(query.estado)) filtros.estado = query.estado;
    else errores.push("estado debe ser APROBADO, RECHAZADO o REVISION_MANUAL");
  }
  for (const campo of ["fechaDesde", "fechaHasta"]) {
    if (query[campo] !== undefined) {
      if (esFechaIsoValida(query[campo])) filtros[campo] = query[campo];
      else errores.push(`${campo} debe ser una fecha YYYY-MM-DD valida`);
    }
  }
  if (filtros.fechaDesde && filtros.fechaHasta && filtros.fechaDesde > filtros.fechaHasta) {
    errores.push("fechaDesde no puede ser posterior a fechaHasta");
  }
  if (query.tiendaId !== undefined) {
    if (typeof query.tiendaId === "string" && query.tiendaId.trim() !== "") filtros.tiendaId = query.tiendaId.trim();
    else errores.push("tiendaId no puede estar vacio");
  }

  let page = 0;
  if (query.page !== undefined) {
    if (typeof query.page === "string" && ENTERO_NO_NEGATIVO.test(query.page)) page = Number(query.page);
    else errores.push("page debe ser un entero mayor o igual que 0");
  }

  let size = paginaTamanoDefecto;
  if (query.size !== undefined) {
    const n = typeof query.size === "string" && ENTERO_NO_NEGATIVO.test(query.size) ? Number(query.size) : NaN;
    if (n >= 1 && n <= paginaTamanoMaximo) size = n;
    else errores.push(`size debe ser un entero entre 1 y ${paginaTamanoMaximo}`);
  }

  if (errores.length > 0) return { ok: false, errores };
  return { ok: true, valor: { filtros, page, size } };
}

/**
 * DTO de salida PaginaRegistros (Spec 7).
 * @param {{ total: number, items: RegistroAuditoria[] }} resultado
 * @param {{ page: number, size: number }} paginacion
 */
function toPaginaRegistrosDto({ total, items }, { page, size }) {
  return {
    total,
    page,
    size,
    items: items.map(toRegistroAuditoriaDto)
  };
}

module.exports = {
  validarParametrosListado,
  toPaginaRegistrosDto
};
