/**
 * Datos semilla de demostracion (RF-03). Solo identificaciones de demo, sin
 * nombres ni otros datos personales (RF-03 crit. 8).
 *
 * Cada registro demuestra una rama de las reglas internas de evaluacion-core
 * (umbrales por defecto: tope aprobacion 500, cuota/ingreso 35%):
 *
 *   1710000001  mora vigente           -> Regla_Mora_Vigente: RECHAZADO sin buro
 *   1720000002  buen historial         -> Regla_Capacidad_Pago: APROBADO sin buro (ej. 450 / 12)
 *   1730000003  SIN registro (404)     -> Regla_Cliente_Nuevo con buro
 *   1740000004  sin ingreso declarado  -> REVISION_MANUAL por datos insuficientes (ej. 1200 / 12)
 *   1750000005  ingreso bajo           -> REVISION_MANUAL por cuota/ingreso (1200 / 6 = 200; 200/300 = 66,7%)
 *
 * 1710000001, 1720000002 y 1730000003 ya los usan Postman, k6 y el test E2E.
 */
const REGISTROS_SEMILLA = Object.freeze([
  Object.freeze({
    identificacion: "1710000001",
    tiene_mora_vigente: true,
    creditos_previos: 3,
    ingresos_declarados: 900,
    fecha_primer_registro: "2022-05-10"
  }),
  Object.freeze({
    identificacion: "1720000002",
    tiene_mora_vigente: false,
    creditos_previos: 6,
    ingresos_declarados: 1500,
    fecha_primer_registro: "2021-01-20"
  }),
  Object.freeze({
    identificacion: "1740000004",
    tiene_mora_vigente: false,
    creditos_previos: 1,
    ingresos_declarados: null,
    fecha_primer_registro: "2024-06-01"
  }),
  Object.freeze({
    identificacion: "1750000005",
    tiene_mora_vigente: false,
    creditos_previos: 2,
    ingresos_declarados: 300,
    fecha_primer_registro: "2023-09-15"
  })
]);

/**
 * Identificaciones de demo que DEBEN responder 404 (cliente nuevo). La siembra
 * las elimina si existieran (RF-03 crit. 3).
 */
const IDENTIFICACIONES_SIN_HISTORIAL = Object.freeze(["1730000003"]);

module.exports = {
  REGISTROS_SEMILLA,
  IDENTIFICACIONES_SIN_HISTORIAL
};
