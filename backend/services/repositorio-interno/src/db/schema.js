/**
 * Esquema de clientes_historial (idempotente).
 *
 * - PK sobre identificacion: busqueda O(log n) (KPI p95 < 500 ms).
 * - Los CHECK replican las restricciones del contrato Spec 6 en la base.
 * - Se persiste fecha_primer_registro y NO antiguedad_meses: la fecha es un
 *   hecho inmutable; la antiguedad se deriva al consultar y nunca queda vieja.
 */
const DDL_CLIENTES_HISTORIAL = `
  CREATE TABLE IF NOT EXISTS clientes_historial (
    identificacion        VARCHAR(20)   PRIMARY KEY,
    tiene_mora_vigente    BOOLEAN       NOT NULL,
    creditos_previos      INTEGER       NOT NULL CHECK (creditos_previos >= 0),
    ingresos_declarados   NUMERIC(12,2) CHECK (ingresos_declarados IS NULL OR ingresos_declarados > 0),
    fecha_primer_registro DATE          NOT NULL
  )
`;

/**
 * @param {{ query: Function }} cliente pool o cliente de node-pg
 */
async function aplicarEsquema(cliente) {
  await cliente.query(DDL_CLIENTES_HISTORIAL);
}

module.exports = {
  DDL_CLIENTES_HISTORIAL,
  aplicarEsquema
};
