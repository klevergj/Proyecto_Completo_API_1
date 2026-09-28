const { errorAuditoria } = require("../utils/errorBffAuditoria");

const DECISIONES = Object.freeze(["APROBADO", "RECHAZADO", "REVISION_MANUAL"]);
const OPCIONALES = ["tiendaId", "identificacion", "montoSolicitado", "plazoMeses", "motivo", "scoreBuro", "registradoEn"];

/**
 * Modelo de dominio del BFF: una evaluacion tal como quedo registrada en
 * auditoria. Inmutable; los opcionales no registrados valen null (Req 3.3).
 */
class EvaluacionAuditada {
  constructor(datos) {
    this.idEvaluacion = datos.idEvaluacion;
    this.fecha = datos.fecha;
    this.decision = datos.decision;
    this.consultaBuroRealizada = datos.consultaBuroRealizada;
    this.reglasAplicadas = Object.freeze([...datos.reglasAplicadas]);
    for (const campo of OPCIONALES) {
      this[campo] = datos[campo] === undefined ? null : datos[campo];
    }
    Object.freeze(this);
  }

  /**
   * Construye el modelo desde un RegistroAuditoriaAlmacenado (Spec 7). Si la
   * respuesta no cumple el contrato, lanza 502 ERROR_AUDITORIA en lugar de
   * mostrar un detalle incompleto.
   * @param {*} registro
   * @returns {EvaluacionAuditada}
   */
  static desdeRegistro(registro) {
    const valido =
      registro !== null &&
      typeof registro === "object" &&
      typeof registro.idEvaluacion === "string" &&
      registro.idEvaluacion.length > 0 &&
      DECISIONES.includes(registro.decision) &&
      typeof registro.fecha === "string" &&
      typeof registro.consultaBuroRealizada === "boolean" &&
      Array.isArray(registro.reglasAplicadas);
    if (!valido) {
      throw errorAuditoria();
    }
    return new EvaluacionAuditada(registro);
  }
}

EvaluacionAuditada.DECISIONES = DECISIONES;

module.exports = EvaluacionAuditada;
