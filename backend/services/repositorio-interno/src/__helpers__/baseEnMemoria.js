/**
 * PostgreSQL en memoria (pg-mem) con el esquema real de clientes_historial,
 * para probar el SQL de produccion sin Docker.
 */
const { newDb } = require("pg-mem");
const { aplicarEsquema } = require("../db/schema");

const INSERTAR = `
  INSERT INTO clientes_historial
    (identificacion, tiene_mora_vigente, creditos_previos, ingresos_declarados, fecha_primer_registro)
  VALUES ($1, $2, $3, $4, $5)
`;

async function crearBaseEnMemoria({ conEsquema = true } = {}) {
  // noAstCoverageCheck: pg-mem se queja cuando CREATE TABLE IF NOT EXISTS
  // encuentra la tabla y no evalua sus CHECK (limitacion de pg-mem; en
  // PostgreSQL el DDL es valido e idempotente).
  const { Pool } = newDb({ noAstCoverageCheck: true }).adapters.createPg();
  const pool = new Pool();
  if (conEsquema) {
    await aplicarEsquema(pool);
  }
  return pool;
}

async function insertarRegistro(pool, r) {
  await pool.query(INSERTAR, [
    r.identificacion,
    r.tiene_mora_vigente,
    r.creditos_previos,
    r.ingresos_declarados,
    r.fecha_primer_registro
  ]);
}

async function leerTabla(pool) {
  const { rows } = await pool.query(
    "SELECT identificacion, tiene_mora_vigente, creditos_previos, ingresos_declarados, fecha_primer_registro FROM clientes_historial ORDER BY identificacion"
  );
  return rows.map((f) => ({
    identificacion: f.identificacion,
    tiene_mora_vigente: f.tiene_mora_vigente,
    creditos_previos: Number(f.creditos_previos),
    ingresos_declarados: f.ingresos_declarados === null ? null : Number(f.ingresos_declarados),
    fecha_primer_registro:
      f.fecha_primer_registro instanceof Date
        ? f.fecha_primer_registro.toISOString().slice(0, 10)
        : f.fecha_primer_registro
  }));
}

module.exports = {
  crearBaseEnMemoria,
  insertarRegistro,
  leerTabla
};
