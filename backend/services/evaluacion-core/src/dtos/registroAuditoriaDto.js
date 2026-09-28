/**
 * Normaliza el score del buro a un entero valido o null.
 * RegistroAuditoria.scoreBuro es integer|null (contrato spec7).
 */
function normalizarScoreBuro(scoreBuro) {
  if (typeof scoreBuro !== "number" || !Number.isFinite(scoreBuro)) {
    return null;
  }
  return Math.trunc(scoreBuro);
}

/**
 * Construye el RegistroAuditoria segun el contrato spec7-auditoria.
 * Incluye scoreBuro (integer|null) y tiendaId (opcional), ademas de los
 * campos base: idEvaluacion, identificacion, montoSolicitado, plazoMeses,
 * decision, motivo, reglasAplicadas, consultaBuroRealizada y fecha.
 */
function toRegistroAuditoriaDto(datos = {}) {
  const registro = {
    idEvaluacion: datos.idEvaluacion,
    identificacion: datos.identificacion,
    montoSolicitado: datos.montoSolicitado,
    plazoMeses: datos.plazoMeses,
    decision: datos.decision,
    motivo: datos.motivo,
    reglasAplicadas: Array.isArray(datos.reglasAplicadas) ? datos.reglasAplicadas : [],
    consultaBuroRealizada: datos.consultaBuroRealizada === true,
    fecha: datos.fecha || new Date().toISOString(),
    scoreBuro: normalizarScoreBuro(datos.scoreBuro)
  };

  // tiendaId es opcional en el contrato; solo se incluye si viene informado.
  if (datos.tiendaId !== undefined && datos.tiendaId !== null) {
    registro.tiendaId = datos.tiendaId;
  }

  return registro;
}

module.exports = {
  toRegistroAuditoriaDto
};
