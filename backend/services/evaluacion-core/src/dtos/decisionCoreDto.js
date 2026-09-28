/**
 * DTO de salida DecisionCore (contrato spec4).
 *
 * @param {{ idEvaluacion: string, decision: { decision: string, motivo: string, reglasAplicadas: string[] },
 *           fecha: string, consultaBuroRealizada: boolean }} datos
 */
function toDecisionCoreDto({ idEvaluacion, decision, fecha, consultaBuroRealizada }) {
  return {
    idEvaluacion,
    decision: decision.decision,
    motivo: decision.motivo,
    fecha,
    consultaBuroRealizada,
    reglasAplicadas: decision.reglasAplicadas
  };
}

module.exports = {
  toDecisionCoreDto
};
