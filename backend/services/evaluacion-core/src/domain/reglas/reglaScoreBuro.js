const reglasConfig = require("../../config/reglasConfig");

/**
 * Regla de Evaluacion (Strategy): Score de Buro Externo.
 *
 * Regla que requiere buro (requiereBuro: true). Rechaza automaticamente
 * solicitudes cuyo score de buro externo sea un numero valido (rango 300-850)
 * y este por debajo del Umbral_Score_Minimo configurado (RF-01).
 *
 * Devuelve null (continuar la cadena) cuando:
 *  - el `score` es nulo, no numerico o esta fuera del rango 300-850 (RF-01 crit. 4, RF-07 crit. 2);
 *  - el `score` es un numero valido pero >= Umbral_Score_Minimo (RF-01 crit. 3);
 *  - el Umbral_Score_Minimo no esta configurado o es invalido (RF-01 crit. 6),
 *    caso en que reglasConfig expone `umbralScoreMinimo` como null.
 *
 * El umbral se lee EXCLUSIVAMENTE desde reglasConfig, nunca de process.env.
 *
 * @param {Object|null} cliente   Historial_Interno del cliente (no usado por esta regla).
 * @param {Object} buro           Datos_Buro normalizado: { score, moraExterna, deudaExternaTotal, estadoBuro }.
 * @param {Object} solicitud      Datos de la solicitud (no usados por esta regla).
 * @returns {{decision: string, motivo: string, nombreRegla: string}|null}
 *          ResultadoRegla si decide, o null para que el Motor_Reglas continue la cadena.
 */
const SCORE_MIN = 300;
const SCORE_MAX = 850;
const NOMBRE = "REGLA_SCORE_BURO";

function evaluar(cliente, buro, solicitud) {
  const umbral = reglasConfig.umbralScoreMinimo;

  // RF-01 crit. 6 / RF-07 crit. 2: umbral no configurado o invalido -> continuar cadena.
  // reglasConfig expone null cuando el valor de entorno es invalido.
  if (typeof umbral !== "number" || !Number.isFinite(umbral)) {
    return null;
  }

  const score = buro ? buro.score : null;

  // RF-01 crit. 4: score nulo, no numerico o fuera de rango -> continuar cadena.
  if (typeof score !== "number" || !Number.isFinite(score) || score < SCORE_MIN || score > SCORE_MAX) {
    return null;
  }

  // RF-01 crit. 1-2: score valido y por debajo del umbral -> RECHAZADO con motivo que lo mencione.
  if (score < umbral) {
    return {
      decision: "RECHAZADO",
      motivo: `El score de buro (${score}) esta por debajo del umbral minimo (${umbral})`,
      nombreRegla: NOMBRE
    };
  }

  // RF-01 crit. 3: score valido y >= umbral -> continuar cadena.
  return null;
}

module.exports = {
  nombre: NOMBRE,
  requiereBuro: true,
  evaluar
};
