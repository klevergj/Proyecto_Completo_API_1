/**
 * Configuracion del BFF Auditoria. Lee process.env UNA sola vez.
 * Los limites de paginacion coinciden con los del Servicio de Auditoria para
 * no pedir nunca un size que el servicio rechace.
 */

const DEFAULTS = Object.freeze({
  port: 8082,
  auditoriaServiceUrl: "http://auditoria:8095",
  auditoriaTimeoutMs: 3000,
  paginaTamanoDefecto: 20,
  paginaTamanoMaximo: 100
});

function estaVacio(valor) {
  return valor === undefined || valor === null || String(valor).trim() === "";
}

function enteroPositivo(nombre, valorEnv, porDefecto) {
  if (estaVacio(valorEnv)) return porDefecto;
  const numero = Number(valorEnv);
  if (!Number.isInteger(numero) || numero <= 0) {
    console.warn(`[BFF Auditoria Config] ${nombre}="${valorEnv}" invalido; se usa el default ${porDefecto}`);
    return porDefecto;
  }
  return numero;
}

/**
 * @param {Object} env objeto de entorno (inyectable en pruebas)
 */
function crearBffAuditoriaConfig(env = process.env) {
  let paginaTamanoDefecto = enteroPositivo("PAGINA_TAMANO_DEFECTO", env.PAGINA_TAMANO_DEFECTO, DEFAULTS.paginaTamanoDefecto);
  let paginaTamanoMaximo = enteroPositivo("PAGINA_TAMANO_MAXIMO", env.PAGINA_TAMANO_MAXIMO, DEFAULTS.paginaTamanoMaximo);

  if (paginaTamanoDefecto > paginaTamanoMaximo) {
    console.warn(
      `[BFF Auditoria Config] PAGINA_TAMANO_DEFECTO (${paginaTamanoDefecto}) > PAGINA_TAMANO_MAXIMO (${paginaTamanoMaximo}); ` +
        `se usan ${DEFAULTS.paginaTamanoDefecto} y ${DEFAULTS.paginaTamanoMaximo}`
    );
    paginaTamanoDefecto = DEFAULTS.paginaTamanoDefecto;
    paginaTamanoMaximo = DEFAULTS.paginaTamanoMaximo;
  }

  return {
    port: enteroPositivo("PORT", env.PORT, DEFAULTS.port),
    auditoriaServiceUrl: estaVacio(env.AUDITORIA_SERVICE_URL) ? DEFAULTS.auditoriaServiceUrl : env.AUDITORIA_SERVICE_URL.trim(),
    auditoriaTimeoutMs: enteroPositivo("AUDITORIA_TIMEOUT_MS", env.AUDITORIA_TIMEOUT_MS, DEFAULTS.auditoriaTimeoutMs),
    paginaTamanoDefecto,
    paginaTamanoMaximo
  };
}

const bffAuditoriaConfig = crearBffAuditoriaConfig();

module.exports = bffAuditoriaConfig;
module.exports.crearBffAuditoriaConfig = crearBffAuditoriaConfig;
module.exports.DEFAULTS = DEFAULTS;
