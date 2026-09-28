/**
 * Configuracion de umbrales del motor de reglas.
 *
 * Modulo unico que lee process.env UNA sola vez (al cargar el modulo) y expone
 * los umbrales tipados con defaults sensatos y validacion de rango.
 *
 * Las reglas del dominio leen SIEMPRE desde este modulo, nunca de process.env
 * directamente. Cuando un valor de entorno es invalido, se expone como null
 * (o el modo se expone como null) para que la regla afectada lo detecte como
 * "valor no configurado" y se auto-inhiba, devolviendo null o derivando a
 * REVISION_MANUAL segun corresponda (RF-01 crit. 6, RF-04 crit. 5, RF-05 crit. 5).
 */

const SCORE_MIN = 300;
const SCORE_MAX = 850;

const MODOS_CUOTA_INGRESO_VALIDOS = ["RECHAZADO", "REVISION_MANUAL"];

/**
 * Parsea un score de buro validando que sea un numero dentro del rango 300-850.
 * @param {string|undefined} valorEnv valor crudo de process.env
 * @param {number} porDefecto valor por defecto a usar cuando la env var no esta definida
 * @returns {number|null} el score valido o null si el valor configurado es invalido
 */
function parsearUmbralScore(valorEnv, porDefecto) {
  if (valorEnv === undefined || valorEnv === null || valorEnv === "") {
    return porDefecto;
  }
  const numero = Number(valorEnv);
  if (!Number.isFinite(numero) || numero < SCORE_MIN || numero > SCORE_MAX) {
    return null;
  }
  return numero;
}

/**
 * Parsea un numero mayor que cero.
 * @param {string|undefined} valorEnv valor crudo de process.env
 * @param {number} porDefecto valor por defecto a usar cuando la env var no esta definida
 * @returns {number|null} el numero valido (> 0) o null si el valor configurado es invalido
 */
function parsearNumeroPositivo(valorEnv, porDefecto) {
  if (valorEnv === undefined || valorEnv === null || valorEnv === "") {
    return porDefecto;
  }
  const numero = Number(valorEnv);
  if (!Number.isFinite(numero) || numero <= 0) {
    return null;
  }
  return numero;
}

/**
 * Parsea el modo de cuota/ingreso validando que sea uno de los valores permitidos.
 * @param {string|undefined} valorEnv valor crudo de process.env
 * @param {string} porDefecto valor por defecto a usar cuando la env var no esta definida
 * @returns {"RECHAZADO"|"REVISION_MANUAL"|null} el modo valido o null si es invalido
 */
function parsearModoCuotaIngreso(valorEnv, porDefecto) {
  if (valorEnv === undefined || valorEnv === null || valorEnv === "") {
    return porDefecto;
  }
  const modo = String(valorEnv).trim().toUpperCase();
  if (!MODOS_CUOTA_INGRESO_VALIDOS.includes(modo)) {
    return null;
  }
  return modo;
}

// Se lee process.env una sola vez al cargar el modulo.
const reglasConfig = {
  // UMBRAL_SCORE_MINIMO: default 600, valida rango 300-850 (RF-01 crit. 5-6)
  umbralScoreMinimo: parsearUmbralScore(process.env.UMBRAL_SCORE_MINIMO, 600),

  // UMBRAL_SCORE_BUENO: default 700, valida rango 300-850 (RF-04 crit. 5)
  umbralScoreBueno: parsearUmbralScore(process.env.UMBRAL_SCORE_BUENO, 700),

  // PORCENTAJE_CUOTA_INGRESO: default 0.35, debe ser numero > 0 (RF-03 crit. 6)
  porcentajeCuotaIngreso: parsearNumeroPositivo(process.env.PORCENTAJE_CUOTA_INGRESO, 0.35),

  // MODO_CUOTA_INGRESO: RECHAZADO | REVISION_MANUAL, default REVISION_MANUAL (RF-03 crit. 6)
  modoCuotaIngreso: parsearModoCuotaIngreso(process.env.MODO_CUOTA_INGRESO, "REVISION_MANUAL"),

  // TOPE_MONTO_APROBACION_AUTOMATICA: default 500, debe ser numero > 0 (RF-05 crit. 3, 5)
  topeMontoAprobacionAutomatica: parsearNumeroPositivo(process.env.TOPE_MONTO_APROBACION_AUTOMATICA, 500)
};

module.exports = reglasConfig;
