const path = require("path");

/**
 * Configuracion del Buro Simulado. Lee process.env UNA sola vez al cargar el
 * modulo (los tests que reducen LATENCIA_MS deben fijarla antes de importar).
 */

// Latencia del escenario LATENCIA_ALTA (Req. 3.2, 3.4). Por defecto 5000 ms;
// si LATENCIA_MS es invalido (NaN) o negativo, se usa 5000.
function parsearLatenciaMs(valorEnv) {
  const valor = parseInt(valorEnv, 10);
  return Number.isNaN(valor) || valor < 0 ? 5000 : valor;
}

const buroConfig = {
  port: process.env.PORT || 8091,
  latenciaMs: parsearLatenciaMs(process.env.LATENCIA_MS),
  // Valor crudo: la normalizacion/validacion la hace el modelo Escenario.
  escenarioInicial: process.env.ESCENARIO_INICIAL,
  // Contrato servido en /docs y /openapi.yaml, leido desde contracts/ (sin
  // copia en el servicio: steering structure.md). En Docker se monta /contracts.
  contratoOpenApiPath:
    process.env.CONTRATO_OPENAPI_PATH ||
    path.join(__dirname, "..", "..", "..", "..", "contracts", "spec5-buro-simulado.yaml")
};

buroConfig.parsearLatenciaMs = parsearLatenciaMs;

module.exports = buroConfig;
