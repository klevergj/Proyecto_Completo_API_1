/**
 * Modelo de dominio Historial_Interno (contrato spec6). Inmutable.
 * La ausencia de historial (cliente nuevo) se representa con `null`, no con
 * una instancia vacia.
 */
class HistorialCliente {
  /**
   * @param {{ identificacion: string, tieneMoraVigente: boolean, creditosPrevios?: number,
   *           ingresosDeclarados: number|null, antiguedadMeses?: number }} datos
   */
  constructor({ identificacion, tieneMoraVigente, creditosPrevios, ingresosDeclarados, antiguedadMeses }) {
    this.identificacion = identificacion;
    this.tieneMoraVigente = tieneMoraVigente;
    this.creditosPrevios = creditosPrevios;
    this.ingresosDeclarados = ingresosDeclarados;
    this.antiguedadMeses = antiguedadMeses;
    Object.freeze(this);
  }
}

module.exports = HistorialCliente;
