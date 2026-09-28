const reglasConfig = require("../../config/reglasConfig");

const NOMBRE_REGLA = "REGLA_CLIENTE_NUEVO";

/**
 * Determina si el historial interno esta ausente (cliente nuevo).
 * Solo la ausencia total de historial (null/undefined) marca a un cliente
 * como nuevo; un historial presente hace que la regla ceda la cadena.
 * @param {Object|null|undefined} historial Historial_Interno del cliente
 * @returns {boolean} true si el cliente no tiene historial interno
 */
function historialAusente(historial) {
  return historial === null || historial === undefined;
}

/**
 * Regla de Evaluacion: Cliente Nuevo sin Historial Interno (Strategy, requiere buro).
 *
 * Solo actua cuando el Historial_Interno esta ausente (cliente nuevo). Con
 * historial presente devuelve null para que el Motor_Reglas continue la cadena.
 *
 * Para un cliente sin historial:
 *  - Si el buro esta disponible y el score es un numero >= Umbral_Score_Bueno,
 *    deriva a REVISION_MANUAL indicando buen score externo (RF-04 crit. 1-2).
 *  - Si el score es nulo, el estadoBuro es INDISPONIBLE, o el Umbral_Score_Bueno
 *    no esta configurado (null), deriva a REVISION_MANUAL indicando la
 *    indisponibilidad del buro externo (RF-04 crit. 4-5, RF-07 crit. 4).
 *
 * El resultado de una regla es: null (continuar) | { decision, motivo, nombreRegla }.
 *
 * @param {Object|null} historial Historial_Interno; null/undefined = cliente nuevo
 * @param {Object} buro Datos_Buro normalizado { score, moraExterna, deudaExternaTotal, estadoBuro }
 * @returns {Object|null} Resultado si la regla decide, o null para continuar la cadena
 */
function evaluar(historial, buro) {
  // Solo actua para clientes sin historial interno.
  if (!historialAusente(historial)) {
    return null;
  }

  const datosBuro = buro || {};
  const score = datosBuro.score;
  const estadoBuro = datosBuro.estadoBuro;
  const umbralScoreBueno = reglasConfig.umbralScoreBueno;

  const buroIndisponible =
    score === null ||
    score === undefined ||
    !Number.isFinite(score) ||
    estadoBuro === "INDISPONIBLE";

  const umbralInvalido = umbralScoreBueno === null || umbralScoreBueno === undefined;

  // Indisponibilidad del buro (o umbral no configurado) para cliente sin historial.
  if (buroIndisponible || umbralInvalido) {
    return {
      decision: "REVISION_MANUAL",
      motivo:
        "Cliente nuevo sin historial interno y sin datos de buro externo disponibles; requiere revision manual",
      nombreRegla: NOMBRE_REGLA
    };
  }

  // Buen score externo para cliente sin historial.
  if (score >= umbralScoreBueno) {
    return {
      decision: "REVISION_MANUAL",
      motivo: `Cliente nuevo sin historial interno con buen score externo (score ${score} >= umbral ${umbralScoreBueno}); requiere revision manual`,
      nombreRegla: NOMBRE_REGLA
    };
  }

  // Cliente sin historial pero con score por debajo del umbral bueno:
  // no decide aqui, la cadena continua (p. ej. hacia el fallback por defecto).
  return null;
}

module.exports = {
  nombre: NOMBRE_REGLA,
  requiereBuro: true,
  evaluar
};
