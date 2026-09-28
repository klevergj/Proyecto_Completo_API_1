const ClienteHistorial = require("../models/clienteHistorial");
const { asegurarHistorialRepository } = require("./historialRepository.interface");

// Consulta parametrizada por clave primaria: la identificacion nunca se
// interpola en el texto SQL (RF-01 crit. 6).
const BUSCAR_POR_IDENTIFICACION = `
  SELECT identificacion, tiene_mora_vigente, creditos_previos, ingresos_declarados, fecha_primer_registro
  FROM clientes_historial
  WHERE identificacion = $1
`;

/**
 * Traduce una fila de clientes_historial (snake_case) al modelo de dominio.
 * node-pg devuelve NUMERIC como cadena para no perder precision: aqui se
 * convierte a number, y null se conserva (RF-01 crit. 3).
 * @param {Object} fila
 * @returns {ClienteHistorial}
 */
function filaAClienteHistorial(fila) {
  return new ClienteHistorial({
    identificacion: fila.identificacion,
    tieneMoraVigente: fila.tiene_mora_vigente,
    creditosPrevios: Number(fila.creditos_previos),
    ingresosDeclarados:
      fila.ingresos_declarados === null || fila.ingresos_declarados === undefined
        ? null
        : Number(fila.ingresos_declarados),
    fechaPrimerRegistro: fila.fecha_primer_registro
  });
}

/**
 * Implementacion PostgreSQL de HistorialRepository. Es el unico modulo que
 * conoce el esquema de la tabla.
 *
 * @param {{ pool: { query: Function } }} deps pool de node-pg (o pg-mem)
 * @returns {import("./historialRepository.interface").HistorialRepository}
 */
function crearPostgresHistorialRepository({ pool }) {
  async function buscarPorIdentificacion(identificacion) {
    const { rows } = await pool.query(BUSCAR_POR_IDENTIFICACION, [identificacion]);
    return rows.length === 0 ? null : filaAClienteHistorial(rows[0]);
  }

  return asegurarHistorialRepository({ buscarPorIdentificacion });
}

module.exports = {
  crearPostgresHistorialRepository,
  filaAClienteHistorial
};
