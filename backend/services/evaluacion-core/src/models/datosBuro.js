/**
 * Modelo de dominio Datos_Buro, normalizado (RF-07). Inmutable.
 *
 * Tanto la respuesta real del buro (ScoreResponse, que no trae estadoBuro)
 * como el fallback del Circuit Breaker se representan con esta misma forma.
 */
class DatosBuro {
  /**
   * @param {{ score: number|null, moraExterna: boolean, deudaExternaTotal: number,
   *           estadoBuro: "DISPONIBLE"|"INDISPONIBLE" }} datos
   */
  constructor({ score, moraExterna, deudaExternaTotal, estadoBuro }) {
    this.score = score;
    this.moraExterna = moraExterna;
    this.deudaExternaTotal = deudaExternaTotal;
    this.estadoBuro = estadoBuro;
    Object.freeze(this);
  }

  /**
   * Resultado de fallback cuando el buro falla, excede su timeout o el
   * Circuit Breaker esta abierto (RF-07 crit. 1).
   * @returns {DatosBuro}
   */
  static indisponible() {
    return new DatosBuro({ score: null, moraExterna: false, deudaExternaTotal: 0, estadoBuro: "INDISPONIBLE" });
  }
}

module.exports = DatosBuro;
