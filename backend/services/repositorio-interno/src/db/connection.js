const { Pool, types } = require("pg");
const repoConfig = require("../config/repoConfig");

// DATE (OID 1082) -> texto "YYYY-MM-DD". Por defecto node-pg lo convierte en un
// Date a medianoche LOCAL, lo que desplaza un dia segun la zona horaria.
const OID_DATE = 1082;
types.setTypeParser(OID_DATE, (valor) => valor);

/**
 * Crea el pool con limites que garantizan fallar rapido (Req 4 crit. 1-2):
 * - connectionTimeoutMillis: espera maxima por una conexion.
 * - statement_timeout: el servidor cancela la consulta (SQLSTATE 57014).
 * - query_timeout: corte del lado del cliente si el servidor no responde.
 * @param {Object} config repoConfig
 */
function crearPool(config = repoConfig) {
  const pool = new Pool({
    ...config.db,
    max: config.dbPoolMax,
    connectionTimeoutMillis: config.dbConexionTimeoutMs,
    statement_timeout: config.dbConsultaTimeoutMs,
    query_timeout: config.dbConsultaTimeoutMs
  });

  // Un cliente inactivo que pierde la conexion no debe tumbar el proceso.
  pool.on("error", (error) => {
    console.error("[Repositorio Interno] Error en cliente inactivo del pool:", error.message);
  });

  return pool;
}

/**
 * Verifica que la base responda (usado por /health).
 * @param {Object} pool
 * @returns {Promise<boolean>}
 */
async function verificarConexion(pool) {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch (error) {
    return false;
  }
}

const pool = crearPool();

module.exports = {
  crearPool,
  verificarConexion,
  query: (text, params) => pool.query(text, params),
  pool
};
