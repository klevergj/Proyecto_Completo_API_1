const { aFechaIso, mesesCompletosEntre } = require("../utils/fechas");

/**
 * Modelo de dominio del historial interno de un cliente.
 *
 * Es lo que devuelve cualquier implementacion de HistorialRepository: no
 * conoce columnas SQL (snake_case) ni el formato HTTP de respuesta. La
 * traduccion desde la base la hace el repositorio concreto y la traduccion
 * hacia el contrato Spec 6 la hace el DTO.
 */
class ClienteHistorial {
  /**
   * @param {{ identificacion: string, tieneMoraVigente: boolean, creditosPrevios: number,
   *           ingresosDeclarados: number|null, fechaPrimerRegistro: string|Date }} datos
   */
  constructor({ identificacion, tieneMoraVigente, creditosPrevios, ingresosDeclarados, fechaPrimerRegistro }) {
    this.identificacion = identificacion;
    this.tieneMoraVigente = tieneMoraVigente;
    this.creditosPrevios = creditosPrevios;
    this.ingresosDeclarados = ingresosDeclarados;
    this.fechaPrimerRegistro = aFechaIso(fechaPrimerRegistro);
    Object.freeze(this);
  }

  /**
   * Meses completos desde el primer registro (RF-01 crit. 4). Se deriva al
   * consultar: en la base solo se guarda la fecha, que nunca queda vieja.
   * @param {Date} ahora
   * @returns {number}
   */
  antiguedadMeses(ahora) {
    return mesesCompletosEntre(this.fechaPrimerRegistro, ahora);
  }
}

module.exports = ClienteHistorial;
