const NOMBRE = "REGLA_MORA_VIGENTE";

/**
 * Regla de Evaluacion (Strategy): Mora Vigente en Historial Interno.
 *
 * Regla interna (no requiere buro). Es la primera de la cadena para proteger
 * el KPI de resolucion sin buro: si el cliente registra mora vigente en el
 * repositorio interno, se rechaza sin consultar el buro externo (RF-02).
 *
 * @param {Object|null} cliente   Historial_Interno del cliente (null = cliente nuevo).
 * @param {Object} solicitud      Datos de la solicitud (no usados por esta regla).
 * @returns {{decision: string, motivo: string, nombreRegla: string}|null}
 *          ResultadoRegla si decide, o null para que el Motor_Reglas continue la cadena.
 */
function evaluar(cliente, solicitud) {
  // Solo decide cuando el historial interno afirma explicitamente mora vigente.
  // Si el historial esta ausente (cliente nuevo) o el flag es falso/indeterminado,
  // devuelve null para continuar la cadena (RF-02 crit. 5).
  if (cliente && cliente.tieneMoraVigente === true) {
    return {
      decision: "RECHAZADO",
      motivo: "El cliente registra mora vigente en el historial interno",
      nombreRegla: NOMBRE
    };
  }

  return null;
}

module.exports = {
  nombre: NOMBRE,
  requiereBuro: false,
  evaluar
};
