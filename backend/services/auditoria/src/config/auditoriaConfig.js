/**
 * Configuracion del Servicio de Auditoria. Lee process.env UNA sola vez.
 *
 * Sin credenciales en el codigo: MONGO_URI solo llega por entorno (Req 5.1).
 * Ante un valor invalido se usa el default y se registra una advertencia.
 */

const DEFAULTS = Object.freeze({
  port: 8095,
  mongoUri: "mongodb://localhost:27017",
  dbName: "auditoria_db",
  mongoTimeoutMs: 2000,
  paginaTamanoDefecto: 20,
  paginaTamanoMaximo: 100,
  dbInitReintentos: 10,
  dbInitEsperaMs: 2000
});

function estaVacio(valor) {
  return valor === undefined || valor === null || String(valor).trim() === "";
}

function enteroPositivo(nombre, valorEnv, porDefecto) {
  if (estaVacio(valorEnv)) return porDefecto;
  const numero = Number(valorEnv);
  if (!Number.isInteger(numero) || numero <= 0) {
    console.warn(`[Auditoria Config] ${nombre}="${valorEnv}" invalido; se usa el default ${porDefecto}`);
    return porDefecto;
  }
  return numero;
}

/**
 * Construye la configuracion a partir de un objeto de entorno (inyectable en pruebas).
 * @param {Object} env
 */
function crearAuditoriaConfig(env = process.env) {
  let paginaTamanoDefecto = enteroPositivo("PAGINA_TAMANO_DEFECTO", env.PAGINA_TAMANO_DEFECTO, DEFAULTS.paginaTamanoDefecto);
  let paginaTamanoMaximo = enteroPositivo("PAGINA_TAMANO_MAXIMO", env.PAGINA_TAMANO_MAXIMO, DEFAULTS.paginaTamanoMaximo);

  // El defecto nunca puede superar al maximo (Req 4.5).
  if (paginaTamanoDefecto > paginaTamanoMaximo) {
    console.warn(
      `[Auditoria Config] PAGINA_TAMANO_DEFECTO (${paginaTamanoDefecto}) > PAGINA_TAMANO_MAXIMO (${paginaTamanoMaximo}); ` +
        `se usan ${DEFAULTS.paginaTamanoDefecto} y ${DEFAULTS.paginaTamanoMaximo}`
    );
    paginaTamanoDefecto = DEFAULTS.paginaTamanoDefecto;
    paginaTamanoMaximo = DEFAULTS.paginaTamanoMaximo;
  }

  return {
    port: enteroPositivo("PORT", env.PORT, DEFAULTS.port),
    mongoUri: estaVacio(env.MONGO_URI) ? DEFAULTS.mongoUri : env.MONGO_URI.trim(),
    dbName: estaVacio(env.DB_NAME) ? DEFAULTS.dbName : env.DB_NAME.trim(),
    mongoTimeoutMs: enteroPositivo("MONGO_TIMEOUT_MS", env.MONGO_TIMEOUT_MS, DEFAULTS.mongoTimeoutMs),
    paginaTamanoDefecto,
    paginaTamanoMaximo,
    dbInitReintentos: enteroPositivo("DB_INIT_REINTENTOS", env.DB_INIT_REINTENTOS, DEFAULTS.dbInitReintentos),
    dbInitEsperaMs: enteroPositivo("DB_INIT_ESPERA_MS", env.DB_INIT_ESPERA_MS, DEFAULTS.dbInitEsperaMs)
  };
}

const auditoriaConfig = crearAuditoriaConfig();

module.exports = auditoriaConfig;
module.exports.crearAuditoriaConfig = crearAuditoriaConfig;
module.exports.DEFAULTS = DEFAULTS;
