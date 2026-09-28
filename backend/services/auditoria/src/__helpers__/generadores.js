/**
 * Generadores fast-check compartidos por las pruebas del Servicio de Auditoria.
 */
const fc = require("fast-check");

const DECISIONES = ["APROBADO", "RECHAZADO", "REVISION_MANUAL"];
const TIENDAS = ["TIENDA-001", "TIENDA-002", "CENTRO-SUR-03"];
const REGLAS = ["REGLA_MORA_VIGENTE", "REGLA_CAPACIDAD_PAGO", "REGLA_SCORE_BURO", "REGLA_CLIENTE_NUEVO", "DEFAULT_APROBADO"];

// Fechas en un rango acotado (pocos dias) para que los filtros por fecha coincidan a menudo.
const arbFechaIso = fc
  .date({ min: new Date("2026-09-01T00:00:00.000Z"), max: new Date("2026-09-10T23:59:59.999Z"), noInvalidDate: true })
  .map((d) => d.toISOString());

const arbDia = fc.integer({ min: 1, max: 10 }).map((d) => `2026-09-${String(d).padStart(2, "0")}`);

/** RegistroAuditoria valido de entrada (Spec 7), como lo envia el core. */
const arbRegistroEntrada = fc.record(
  {
    idEvaluacion: fc.uuid(),
    identificacion: fc.stringMatching(/^[0-9]{10}$/),
    montoSolicitado: fc.integer({ min: 1, max: 1000000 }),
    plazoMeses: fc.integer({ min: 1, max: 360 }),
    tiendaId: fc.constantFrom(...TIENDAS),
    decision: fc.constantFrom(...DECISIONES),
    motivo: fc.string({ maxLength: 60 }),
    fecha: arbFechaIso,
    consultaBuroRealizada: fc.boolean(),
    scoreBuro: fc.option(fc.integer({ min: 300, max: 850 }), { nil: null }),
    reglasAplicadas: fc.subarray(REGLAS)
  },
  { requiredKeys: ["idEvaluacion", "decision", "fecha", "consultaBuroRealizada", "reglasAplicadas"] }
);

/** Filtros de listado validos (cada uno opcional). */
const arbFiltros = fc
  .record(
    {
      estado: fc.constantFrom(...DECISIONES),
      fechaDesde: arbDia,
      fechaHasta: arbDia,
      tiendaId: fc.constantFrom(...TIENDAS)
    },
    { requiredKeys: [] }
  )
  .filter((f) => !(f.fechaDesde && f.fechaHasta && f.fechaDesde > f.fechaHasta));

/** Oraculo independiente: comparaciones de texto sobre el ISO (UTC, 'Z'). */
function cumpleFiltros(registro, filtros) {
  const dia = registro.fecha.slice(0, 10);
  return (
    (!filtros.estado || registro.decision === filtros.estado) &&
    (!filtros.tiendaId || registro.tiendaId === filtros.tiendaId) &&
    (!filtros.fechaDesde || dia >= filtros.fechaDesde) &&
    (!filtros.fechaHasta || dia <= filtros.fechaHasta)
  );
}

/** Orden esperado: fecha descendente, idEvaluacion ascendente. */
function compararOrden(a, b) {
  if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
  return a.idEvaluacion < b.idEvaluacion ? -1 : a.idEvaluacion > b.idEvaluacion ? 1 : 0;
}

module.exports = {
  DECISIONES,
  TIENDAS,
  REGLAS,
  arbFechaIso,
  arbDia,
  arbRegistroEntrada,
  arbFiltros,
  cumpleFiltros,
  compararOrden
};
