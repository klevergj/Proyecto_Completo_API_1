/**
 * Mensaje para el cliente por decision (RF-03). Depende SOLO de la decision:
 * el `motivo` del core puede revelar mora, score o ingresos y nunca se muestra
 * en caja (RF-03 crit. 4).
 */
const MENSAJES_POR_DECISION = Object.freeze({
  APROBADO: "Crédito aprobado",
  REVISION_MANUAL: "En revisión, te contactaremos",
  RECHAZADO: "Crédito no aprobado en esta ocasión"
});

/**
 * DTO de salida ResultadoPos (contrato Spec 2): exactamente tres campos (RF-02).
 * @param {import("../models/resultadoEvaluacion")} resultado
 * @returns {{ idEvaluacion: string, aprobado: boolean, mensajeParaCliente: string }}
 */
function toResultadoPosDto(resultado) {
  return {
    idEvaluacion: resultado.idEvaluacion,
    aprobado: resultado.decision === "APROBADO",
    mensajeParaCliente: MENSAJES_POR_DECISION[resultado.decision]
  };
}

module.exports = {
  MENSAJES_POR_DECISION,
  toResultadoPosDto
};
