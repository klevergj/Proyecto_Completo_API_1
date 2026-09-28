/**
 * Descompone una fecha en componentes UTC { anio, mes, dia }.
 * Acepta "YYYY-MM-DD" (lo que devuelve node-pg con el parser de DATE del
 * servicio) o un Date (lo que devuelve pg-mem, a medianoche UTC).
 * @param {string|Date} fecha
 */
function componentesUtc(fecha) {
  if (typeof fecha === "string") {
    const [anio, mes, dia] = fecha.slice(0, 10).split("-").map(Number);
    return { anio, mes, dia };
  }
  return { anio: fecha.getUTCFullYear(), mes: fecha.getUTCMonth() + 1, dia: fecha.getUTCDate() };
}

/**
 * Normaliza una fecha a texto "YYYY-MM-DD".
 * @param {string|Date} fecha
 * @returns {string}
 */
function aFechaIso(fecha) {
  const { anio, mes, dia } = componentesUtc(fecha);
  return `${String(anio).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/**
 * Meses completos transcurridos entre `desde` y `hasta`, con minimo 0.
 * @param {string|Date} desde
 * @param {string|Date} hasta
 * @returns {number}
 */
function mesesCompletosEntre(desde, hasta) {
  const inicio = componentesUtc(desde);
  const fin = componentesUtc(hasta);
  const meses = (fin.anio - inicio.anio) * 12 + (fin.mes - inicio.mes) - (fin.dia < inicio.dia ? 1 : 0);
  return Math.max(0, meses);
}

module.exports = {
  componentesUtc,
  aFechaIso,
  mesesCompletosEntre
};
