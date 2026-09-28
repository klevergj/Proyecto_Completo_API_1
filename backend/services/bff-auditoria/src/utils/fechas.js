const FECHA_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Indica si `valor` es una fecha de calendario real YYYY-MM-DD (rechaza 2026-02-30).
 * Propia del BFF: los servicios no comparten codigo (steering structure.md).
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

module.exports = {
  esFechaIsoValida
};
