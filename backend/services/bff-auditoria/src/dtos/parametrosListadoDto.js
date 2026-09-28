const { esFechaIsoValida } = require("../utils/fechas");
const EvaluacionAuditada = require("../models/evaluacionAuditada");

const ENTERO_NO_NEGATIVO = /^\d+$/;

/**
 * Valida la FORMA de los parametros del listado (no es logica de negocio) y
 * devuelve solo las claves con valor (lista blanca, Req 1.2-1.3, 2.1-2.2).
 *
 * @param {Object} query req.query
 * @param {{ paginaTamanoDefecto: number, paginaTamanoMaximo: number }} paginacion
 * @returns {{ ok: true, valor: Object } | { ok: false, errores: string[] }}
 */
function validarParametrosListado(query = {}, { paginaTamanoDefecto, paginaTamanoMaximo }) {
  const errores = [];
  const valor = {};

  if (query.estado !== undefined) {
    if (EvaluacionAuditada.DECISIONES.includes(query.estado)) valor.estado = query.estado;
    else errores.push("estado debe ser APROBADO, RECHAZADO o REVISION_MANUAL");
  }
  for (const campo of ["fechaDesde", "fechaHasta"]) {
    if (query[campo] !== undefined) {
      if (esFechaIsoValida(query[campo])) valor[campo] = query[campo];
      else errores.push(`${campo} debe ser una fecha YYYY-MM-DD valida`);
    }
  }
  if (valor.fechaDesde && valor.fechaHasta && valor.fechaDesde > valor.fechaHasta) {
    errores.push("fechaDesde no puede ser posterior a fechaHasta");
  }
  if (query.tiendaId !== undefined) {
    if (typeof query.tiendaId === "string" && query.tiendaId.trim() !== "") valor.tiendaId = query.tiendaId.trim();
    else errores.push("tiendaId no puede estar vacio");
  }

  valor.page = 0;
  if (query.page !== undefined) {
    if (typeof query.page === "string" && ENTERO_NO_NEGATIVO.test(query.page)) valor.page = Number(query.page);
    else errores.push("page debe ser un entero mayor o igual que 0");
  }

  valor.size = paginaTamanoDefecto;
  if (query.size !== undefined) {
    const n = typeof query.size === "string" && ENTERO_NO_NEGATIVO.test(query.size) ? Number(query.size) : NaN;
    if (n >= 1 && n <= paginaTamanoMaximo) valor.size = n;
    else errores.push(`size debe ser un entero entre 1 y ${paginaTamanoMaximo}`);
  }

  if (errores.length > 0) return { ok: false, errores };
  return { ok: true, valor };
}

module.exports = {
  validarParametrosListado
};
