/**
 * Configuracion del Repositorio Interno.
 *
 * Modulo unico que lee process.env UNA sola vez (al cargar el modulo). Ante un
 * valor invalido se usa el default y se registra una advertencia.
 *
 * Presupuesto de latencia: dbConexionTimeoutMs + dbConsultaTimeoutMs (1500 +
 * 2000 = 3500 ms) queda por debajo de los 4000 ms del adaptador del core, de
 * modo que el core siempre recibe un 503 explicito antes de abandonar (Req 4 crit. 5).
 */

const DEFAULTS = {
  db: {
    host: "postgres",
    port: 5432,
    user: "resuelve_user",
    password: "resuelve_pass",
    database: "resuelve_db"
  },
  dbPoolMax: 10,
  dbConexionTimeoutMs: 1500,
  dbConsultaTimeoutMs: 2000,
  seedAlIniciar: true,
  dbInitReintentos: 10,
  dbInitEsperaMs: 2000
};

function estaVacio(valorEnv) {
  return valorEnv === undefined || valorEnv === null || String(valorEnv).trim() === "";
}

function texto(valorEnv, porDefecto) {
  return estaVacio(valorEnv) ? porDefecto : String(valorEnv).trim();
}

/**
 * Parsea un numero mayor que cero (opcionalmente entero).
 * @param {string} nombre nombre de la env var (para el log)
 * @param {string|undefined} valorEnv
 * @param {number} porDefecto
 * @param {{ entero?: boolean }} [opciones]
 * @returns {number}
 */
function numeroPositivo(nombre, valorEnv, porDefecto, { entero = false } = {}) {
  if (estaVacio(valorEnv)) {
    return porDefecto;
  }
  const numero = Number(valorEnv);
  const valido = Number.isFinite(numero) && numero > 0 && (!entero || Number.isInteger(numero));
  if (!valido) {
    console.warn(`[Repositorio Interno Config] ${nombre}="${valorEnv}" invalido; se usa el default ${porDefecto}`);
    return porDefecto;
  }
  return numero;
}

const env = process.env;

const repoConfig = {
  db: {
    host: texto(env.DB_HOST, DEFAULTS.db.host),
    port: numeroPositivo("DB_PORT", env.DB_PORT, DEFAULTS.db.port, { entero: true }),
    user: texto(env.DB_USER, DEFAULTS.db.user),
    password: texto(env.DB_PASSWORD, DEFAULTS.db.password),
    database: texto(env.DB_NAME, DEFAULTS.db.database)
  },
  dbPoolMax: numeroPositivo("DB_POOL_MAX", env.DB_POOL_MAX, DEFAULTS.dbPoolMax, { entero: true }),
  dbConexionTimeoutMs: numeroPositivo("DB_CONEXION_TIMEOUT_MS", env.DB_CONEXION_TIMEOUT_MS, DEFAULTS.dbConexionTimeoutMs),
  dbConsultaTimeoutMs: numeroPositivo("DB_CONSULTA_TIMEOUT_MS", env.DB_CONSULTA_TIMEOUT_MS, DEFAULTS.dbConsultaTimeoutMs),
  // Solo el valor literal "false" desactiva la siembra al arrancar (RF-03 crit. 6).
  seedAlIniciar: String(env.SEED_AL_INICIAR || "").trim().toLowerCase() !== "false",
  dbInitReintentos: numeroPositivo("DB_INIT_REINTENTOS", env.DB_INIT_REINTENTOS, DEFAULTS.dbInitReintentos, { entero: true }),
  dbInitEsperaMs: numeroPositivo("DB_INIT_ESPERA_MS", env.DB_INIT_ESPERA_MS, DEFAULTS.dbInitEsperaMs)
};

repoConfig.DEFAULTS = DEFAULTS;

module.exports = repoConfig;
