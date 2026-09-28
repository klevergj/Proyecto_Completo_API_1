const { esFechaHoraIsoValida } = require("../utils/fechas");
const RegistroAuditoria = require("../models/registroAuditoria");

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const esTexto = (v) => typeof v === "string";
const esNumeroFinito = (v) => typeof v === "number" && Number.isFinite(v);

/**
 * Valida el RegistroAuditoria de entrada (Spec 7) y lo reduce por LISTA BLANCA
 * a los campos del contrato (Req 1.3-1.5). Acumula todos los errores.
 *
 * @param {*} body
 * @returns {{ ok: true, valor: Object } | { ok: false, errores: string[] }}
 */
function validarRegistroAuditoria(body) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, errores: ["El cuerpo debe ser un objeto JSON"] };
  }

  const errores = [];

  // Obligatorios
  if (!esTexto(body.idEvaluacion) || !UUID_REGEX.test(body.idEvaluacion)) errores.push("idEvaluacion debe ser un UUID");
  if (!RegistroAuditoria.DECISIONES.includes(body.decision)) errores.push("decision debe ser APROBADO, RECHAZADO o REVISION_MANUAL");
  if (!esFechaHoraIsoValida(body.fecha)) errores.push("fecha debe ser una fecha-hora ISO 8601");
  if (typeof body.consultaBuroRealizada !== "boolean") errores.push("consultaBuroRealizada debe ser booleano");
  if (!Array.isArray(body.reglasAplicadas) || !body.reglasAplicadas.every(esTexto)) {
    errores.push("reglasAplicadas debe ser una lista de cadenas");
  }

  // Opcionales: si vienen, con el tipo del contrato
  for (const campo of ["identificacion", "tiendaId", "motivo"]) {
    if (body[campo] !== undefined && !esTexto(body[campo])) errores.push(`${campo} debe ser una cadena`);
  }
  if (body.montoSolicitado !== undefined && !esNumeroFinito(body.montoSolicitado)) errores.push("montoSolicitado debe ser numerico");
  if (body.plazoMeses !== undefined && !Number.isInteger(body.plazoMeses)) errores.push("plazoMeses debe ser entero");
  if (body.scoreBuro !== undefined && body.scoreBuro !== null && !Number.isInteger(body.scoreBuro)) {
    errores.push("scoreBuro debe ser entero o null");
  }

  if (errores.length > 0) return { ok: false, errores };

  return {
    ok: true,
    valor: {
      idEvaluacion: body.idEvaluacion.toLowerCase(),
      identificacion: body.identificacion,
      montoSolicitado: body.montoSolicitado,
      plazoMeses: body.plazoMeses,
      tiendaId: body.tiendaId,
      decision: body.decision,
      motivo: body.motivo,
      fecha: body.fecha,
      consultaBuroRealizada: body.consultaBuroRealizada,
      scoreBuro: body.scoreBuro,
      reglasAplicadas: [...body.reglasAplicadas]
    }
  };
}

/**
 * DTO de salida RegistroAuditoriaAlmacenado: fechas como ISO 8601.
 * @param {RegistroAuditoria} registro
 */
function toRegistroAuditoriaDto(registro) {
  return {
    idEvaluacion: registro.idEvaluacion,
    identificacion: registro.identificacion,
    montoSolicitado: registro.montoSolicitado,
    plazoMeses: registro.plazoMeses,
    tiendaId: registro.tiendaId,
    decision: registro.decision,
    motivo: registro.motivo,
    fecha: registro.fecha.toISOString(),
    consultaBuroRealizada: registro.consultaBuroRealizada,
    scoreBuro: registro.scoreBuro,
    reglasAplicadas: [...registro.reglasAplicadas],
    registradoEn: registro.registradoEn.toISOString()
  };
}

module.exports = {
  UUID_REGEX,
  validarRegistroAuditoria,
  toRegistroAuditoriaDto
};
