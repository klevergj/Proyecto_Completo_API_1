/**
 * DTO de salida HistorialCliente (contrato Spec 6).
 *
 * Construye la respuesta por LISTA BLANCA: exactamente cinco campos, sin
 * datos personales ni internos (RF-01 crit. 2).
 *
 * @param {import("../models/clienteHistorial")} cliente modelo de dominio
 * @param {Date} ahora instante de la consulta (para antiguedadMeses)
 * @returns {{ identificacion: string, tieneMoraVigente: boolean, creditosPrevios: number,
 *             ingresosDeclarados: number|null, antiguedadMeses: number }}
 */
function toHistorialClienteDto(cliente, ahora) {
  return {
    identificacion: cliente.identificacion,
    tieneMoraVigente: cliente.tieneMoraVigente,
    creditosPrevios: cliente.creditosPrevios,
    ingresosDeclarados: cliente.ingresosDeclarados,
    antiguedadMeses: cliente.antiguedadMeses(ahora)
  };
}

module.exports = {
  toHistorialClienteDto
};
