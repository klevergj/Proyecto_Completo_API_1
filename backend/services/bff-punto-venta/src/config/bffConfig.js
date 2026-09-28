/**
 * Configuracion del BFF Punto de Venta.
 *
 * Modulo unico que lee process.env UNA sola vez (al cargar el modulo) y expone
 * valores tipados con defaults. Ante un valor invalido se usa el default y se
 * registra una advertencia: el BFF no tiene reglas que puedan auto-inhibirse,
 * por lo que un default seguro es preferible a un valor nulo.
 */

const DEFAULTS = {
  coreUrl: "http://evaluacion-core:8090",
  coreTimeoutMs: 5000,
  cacheTtlMs: 900000,
  cacheMaxEntradas: 1000
};

function estaVacio(valorEnv) {
  return valorEnv === undefined || valorEnv === null || String(valorEnv).trim() === "";
}

/**
 * Parsea un numero mayor que cero (opcionalmente entero).
 * @param {string} nombre nombre de la env var (para el log)
 * @param {string|undefined} valorEnv valor crudo de process.env
 * @param {number} porDefecto
 * @param {{ entero?: boolean }} [opciones]
 * @returns {number}
 */
function parsearNumeroPositivo(nombre, valorEnv, porDefecto, { entero = false } = {}) {
  if (estaVacio(valorEnv)) {
    return porDefecto;
  }
  const numero = Number(valorEnv);
  const valido = Number.isFinite(numero) && numero > 0 && (!entero || Number.isInteger(numero));
  if (!valido) {
    console.warn(`[BFF POS Config] ${nombre}="${valorEnv}" invalido; se usa el default ${porDefecto}`);
    return porDefecto;
  }
  return numero;
}

const bffConfig = {
  // EVALUACION_CORE_URL: URL base del Servicio de Evaluacion (core)
  coreUrl: estaVacio(process.env.EVALUACION_CORE_URL)
    ? DEFAULTS.coreUrl
    : process.env.EVALUACION_CORE_URL.trim(),

  // CORE_TIMEOUT_MS: tiempo maximo de espera al core (RF-05 crit. 1)
  coreTimeoutMs: parsearNumeroPositivo("CORE_TIMEOUT_MS", process.env.CORE_TIMEOUT_MS, DEFAULTS.coreTimeoutMs),

  // CACHE_TTL_MS: vida de una entrada del Cache_Resultados (RF-04 crit. 6)
  cacheTtlMs: parsearNumeroPositivo("CACHE_TTL_MS", process.env.CACHE_TTL_MS, DEFAULTS.cacheTtlMs),

  // CACHE_MAX_ENTRADAS: capacidad maxima del Cache_Resultados (RF-04 crit. 7)
  cacheMaxEntradas: parsearNumeroPositivo(
    "CACHE_MAX_ENTRADAS",
    process.env.CACHE_MAX_ENTRADAS,
    DEFAULTS.cacheMaxEntradas,
    { entero: true }
  )
};

bffConfig.DEFAULTS = DEFAULTS;

module.exports = bffConfig;
