/**
 * DTO de entrada SolicitudEvaluacionPos (Spec 2) y su traduccion a la
 * SolicitudCore (Spec 4).
 *
 * La validacion es solo de FORMA del contrato (tipos, obligatoriedad,
 * positivos): las reglas de credito viven unicamente en evaluacion-core
 * (steering tech.md).
 */

function esTextoNoVacio(valor) {
  return typeof valor === "string" && valor.trim().length > 0;
}

/**
 * Traduce por LISTA BLANCA: solo viajan los cuatro campos del contrato;
 * cualquier campo extra (p. ej. referenciaPartner) se descarta (RF-01 crit. 2).
 * Se asume una solicitud ya validada.
 * @param {Object} solicitudPos
 */
function toSolicitudCore(solicitudPos) {
  return {
    identificacion: solicitudPos.identificacion.trim(),
    montoSolicitado: solicitudPos.montoSolicitado,
    plazoMeses: solicitudPos.plazoMeses,
    tiendaId: solicitudPos.tiendaId.trim()
  };
}

/**
 * Valida la SolicitudEvaluacionPos (RF-01 crit. 3-8). Acumula todos los
 * errores para que el cajero corrija el formulario en un solo intento. Sin
 * coercion de tipos: un monto "450" (string) se rechaza.
 *
 * @param {*} body
 * @returns {{ ok: true, valor: Object } | { ok: false, errores: string[] }}
 */
function validarSolicitudEvaluacionPos(body) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, errores: ["El cuerpo de la solicitud debe ser un objeto JSON"] };
  }

  const errores = [];

  if (!esTextoNoVacio(body.identificacion)) {
    errores.push("La identificación es obligatoria");
  }
  if (!(typeof body.montoSolicitado === "number" && Number.isFinite(body.montoSolicitado) && body.montoSolicitado > 0)) {
    errores.push("El monto solicitado debe ser un número mayor que cero");
  }
  if (!(Number.isInteger(body.plazoMeses) && body.plazoMeses > 0)) {
    errores.push("El plazo en meses debe ser un número entero mayor que cero");
  }
  if (!esTextoNoVacio(body.tiendaId)) {
    errores.push("El identificador de tienda es obligatorio");
  }

  if (errores.length > 0) {
    return { ok: false, errores };
  }
  return { ok: true, valor: toSolicitudCore(body) };
}

module.exports = {
  toSolicitudCore,
  validarSolicitudEvaluacionPos
};
