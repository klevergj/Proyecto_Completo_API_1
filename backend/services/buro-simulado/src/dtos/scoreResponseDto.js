/**
 * DTO de salida ScoreResponse (contrato spec5-buro-simulado.yaml).
 *
 * @param {{ identificacion: string, calculo: { score: number, moraExterna: boolean, deudaExternaTotal: number },
 *           escenario: string, fecha: Date }} datos
 */
function toScoreResponseDto({ identificacion, calculo, escenario, fecha }) {
  return {
    identificacion,
    score: calculo.score,
    moraExterna: calculo.moraExterna,
    deudaExternaTotal: calculo.deudaExternaTotal,
    fechaConsulta: fecha.toISOString(),
    escenarioSimulado: escenario
  };
}

module.exports = {
  toScoreResponseDto
};
