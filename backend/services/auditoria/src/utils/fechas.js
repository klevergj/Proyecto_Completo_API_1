const FECHA_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Indica si `valor` es una fecha de calendario real en formato YYYY-MM-DD
 * (rechaza 2026-02-30, 2026-13-01, etc.).
 * @param {*} valor
 * @returns {boolean}
 */
function esFechaIsoValida(valor) {
  if (typeof valor !== "string") return false;
  const m = FECHA_REGEX.exec(valor);
  if (!m) return false;
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
}

/**
 * Inicio (00:00:00.000 UTC) del dia indicado.
 * @param {string} fechaIso YYYY-MM-DD valida
 * @returns {Date}
 */
function inicioDiaUtc(fechaIso) {
  const [anio, mes, dia] = fechaIso.split("-").map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia));
}

/**
 * Inicio del dia SIGUIENTE en UTC: limite exclusivo para incluir todo `fechaIso`.
 * @param {string} fechaIso YYYY-MM-DD valida
 * @returns {Date}
 */
function inicioDiaSiguienteUtc(fechaIso) {
  const inicio = inicioDiaUtc(fechaIso);
  return new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
}

/**
 * Indica si `valor` es una fecha-hora ISO 8601 con hora, interpretable por Date.
 * @param {*} valor
 * @returns {boolean}
 */
function esFechaHoraIsoValida(valor) {
  return (
    typeof valor === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(valor) &&
    !Number.isNaN(Date.parse(valor))
  );
}

module.exports = {
  esFechaIsoValida,
  esFechaHoraIsoValida,
  inicioDiaUtc,
  inicioDiaSiguienteUtc
};
