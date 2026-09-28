/**
 * Configuracion de infraestructura de evaluacion-core (URLs y timeouts de las
 * dependencias). Los umbrales de negocio viven en reglasConfig.js.
 */
const coreConfig = {
  port: process.env.PORT || 8090,
  buroUrl: process.env.BURO_SIMULADO_URL || "http://buro-simulado:8091",
  buroTimeoutMs: 3000,
  repositorioInternoUrl: process.env.REPOSITORIO_INTERNO_URL || "http://repositorio-interno:8092",
  repositorioInternoTimeoutMs: 4000,
  auditoriaUrl: process.env.AUDITORIA_SERVICE_URL || "http://auditoria:8095",
  auditoriaTimeoutMs: 3000,
  // Circuit Breaker (opossum) del buro externo (RF-07)
  circuitBreaker: {
    timeout: 3000,
    errorThresholdPercentage: 50,
    resetTimeout: 10000
  }
};

module.exports = coreConfig;
