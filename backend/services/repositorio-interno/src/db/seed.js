/**
 * Proceso de siembra (RF-03): crea el esquema si no existe, carga los datos
 * semilla con upsert y garantiza la ausencia de los clientes nuevos de demo.
 *
 * Es transaccional e idempotente: ejecutarlo una o varias veces deja la base en
 * el mismo estado para las identificaciones de demo (RF-03 crit. 5).
 *
 * Uso como script: `npm run seed`.
 */
const { aplicarEsquema } = require("./schema");
const { REGISTROS_SEMILLA, IDENTIFICACIONES_SIN_HISTORIAL } = require("./seedData");

const UPSERT_REGISTRO = `
  INSERT INTO clientes_historial
    (identificacion, tiene_mora_vigente, creditos_previos, ingresos_declarados, fecha_primer_registro)
  VALUES ($1, $2, $3, $4, $5)
  ON CONFLICT (identificacion) DO UPDATE SET
    tiene_mora_vigente    = EXCLUDED.tiene_mora_vigente,
    creditos_previos      = EXCLUDED.creditos_previos,
    ingresos_declarados   = EXCLUDED.ingresos_declarados,
    fecha_primer_registro = EXCLUDED.fecha_primer_registro
`;

const BORRAR_REGISTRO = "DELETE FROM clientes_historial WHERE identificacion = $1";

/**
 * @param {Object} pool pool de node-pg (o compatible, p. ej. pg-mem)
 * @returns {Promise<{ sembrados: number, eliminados: number }>}
 */
async function sembrar(pool) {
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");
    await aplicarEsquema(cliente);

    for (const registro of REGISTROS_SEMILLA) {
      await cliente.query(UPSERT_REGISTRO, [
        registro.identificacion,
        registro.tiene_mora_vigente,
        registro.creditos_previos,
        registro.ingresos_declarados,
        registro.fecha_primer_registro
      ]);
    }

    for (const identificacion of IDENTIFICACIONES_SIN_HISTORIAL) {
      await cliente.query(BORRAR_REGISTRO, [identificacion]);
    }

    await cliente.query("COMMIT");
    return { sembrados: REGISTROS_SEMILLA.length, eliminados: IDENTIFICACIONES_SIN_HISTORIAL.length };
  } catch (error) {
    await cliente.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    cliente.release();
  }
}

if (require.main === module) {
  require("dotenv").config();
  const { pool } = require("./connection");
  sembrar(pool)
    .then(({ sembrados, eliminados }) => {
      console.log(`[Seed] Completado: ${sembrados} registros sembrados, ${eliminados} clientes nuevos garantizados sin historial.`);
      return pool.end();
    })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[Seed Error]:", err.message);
      process.exit(1);
    });
}

module.exports = {
  sembrar
};
