const client = require("prom-client");

// Buckets alineados con los KPIs (0,5 s para p95 y 3 s para el 95 % de solicitudes).
const BUCKETS_SEGUNDOS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 3, 5, 10];
const ETIQUETAS = ["metodo", "ruta", "codigo"];

/**
 * Registro Prometheus propio (no el global) para poder aislarlo en pruebas.
 * @returns {{ registro: client.Registry, duracion: client.Histogram, peticiones: client.Counter }}
 */
function crearRegistroMetricas() {
  const registro = new client.Registry();
  client.collectDefaultMetrics({ register: registro, prefix: "gateway_" });

  const duracion = new client.Histogram({
    name: "gateway_http_request_duration_seconds",
    help: "Latencia de las peticiones atendidas por el Gateway",
    labelNames: ETIQUETAS,
    buckets: BUCKETS_SEGUNDOS,
    registers: [registro]
  });

  const peticiones = new client.Counter({
    name: "gateway_http_requests_total",
    help: "Peticiones atendidas por el Gateway",
    labelNames: ETIQUETAS,
    registers: [registro]
  });

  return { registro, duracion, peticiones };
}

module.exports = {
  crearRegistroMetricas,
  BUCKETS_SEGUNDOS
};
