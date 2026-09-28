/**
 * Genera un score deterministico y estado de mora a partir de la identificacion
 * (hash). La misma identificacion produce siempre los mismos valores (Req. 2).
 *
 * @param {string} identificacion
 * @returns {{ score: number, moraExterna: boolean, deudaExternaTotal: number }}
 */
function calcularScoreDeterministico(identificacion) {
  let hash = 0;
  for (let i = 0; i < identificacion.length; i++) {
    hash = (hash << 5) - hash + identificacion.charCodeAt(i);
    hash |= 0;
  }
  const absHash = Math.abs(hash);
  // Rango tipico de score: [300, 850]
  const score = 300 + (absHash % 551);
  const moraExterna = (absHash % 10) === 0; // 10% probabilidad deterministica

  return {
    score,
    moraExterna,
    deudaExternaTotal: moraExterna ? (absHash % 5000) + 500 : 0
  };
}

module.exports = {
  calcularScoreDeterministico
};
