/**
 * Modelo de dominio del registro de auditoria de una decision de credito.
 * Inmutable. `fecha` y `registradoEn` son Date (permiten rangos y orden);
 * los campos opcionales no recibidos valen null (misma forma siempre).
 */
class RegistroAuditoria {
  /**
   * @param {{ idEvaluacion: string, identificacion?: string|null, montoSolicitado?: number|null,
   *           plazoMeses?: number|null, tiendaId?: string|null, decision: string, motivo?: string|null,
   *           fecha: Date|string, consultaBuroRealizada: boolean, scoreBuro?: number|null,
   *           reglasAplicadas: string[], registradoEn: Date|string }} datos
   */
  constructor(datos) {
    this.idEvaluacion = datos.idEvaluacion;
    this.identificacion = valorONull(datos.identificacion);
    this.montoSolicitado = valorONull(datos.montoSolicitado);
    this.plazoMeses = valorONull(datos.plazoMeses);
    this.tiendaId = valorONull(datos.tiendaId);
    this.decision = datos.decision;
    this.motivo = valorONull(datos.motivo);
    this.fecha = new Date(datos.fecha);
    this.consultaBuroRealizada = datos.consultaBuroRealizada;
    this.scoreBuro = valorONull(datos.scoreBuro);
    this.reglasAplicadas = Object.freeze([...datos.reglasAplicadas]);
    this.registradoEn = new Date(datos.registradoEn);
    Object.freeze(this);
  }
}

function valorONull(valor) {
  return valor === undefined ? null : valor;
}

RegistroAuditoria.DECISIONES = Object.freeze(["APROBADO", "RECHAZADO", "REVISION_MANUAL"]);

module.exports = RegistroAuditoria;
