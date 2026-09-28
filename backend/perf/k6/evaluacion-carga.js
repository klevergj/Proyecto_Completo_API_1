import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * Prueba de carga (Fase 4) contra el API Gateway, contrato /v1 (spec1 v1.1.0).
 *
 * Ejecutar:
 *   k6 run perf/k6/evaluacion-carga.js
 *   k6 run -e GATEWAY_URL=http://localhost:8080 perf/k6/evaluacion-carga.js
 *
 * Autenticacion: hoy el Gateway corre con AUTH_HABILITADA=false (sin token).
 * Cuando se active OAuth2, pasar un token client_credentials con scope
 * evaluaciones:escribir:  k6 run -e GATEWAY_TOKEN=<access_token> ...
 *
 * Metricas del lado servidor: el Gateway expone Prometheus en su puerto
 * interno (METRICS_PORT, /metrics) con latencia por ruta y codigo.
 */
export const options = {
  stages: [
    { duration: '30s', target: 100 }, // rampa a 100 usuarios concurrentes
    { duration: '1m', target: 100 },  // carga sostenida
    { duration: '30s', target: 500 }, // pico de 500 (KPI: soportar 100-500 sin degradar)
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // KPI: p95 < 500 ms bajo carga sostenida
    'http_req_duration{tipo:evaluacion}': ['p(95)<3000'], // KPI: 95 % de solicitudes < 3 s
    http_req_failed: ['rate<0.01'],   // KPI: tasa de error < 1 %
  },
};

const BASE_URL = __ENV.GATEWAY_URL || 'http://localhost:8080';
const TOKEN = __ENV.GATEWAY_TOKEN;

// Mezcla sobre los datos semilla del repositorio interno: mora, buen historial,
// cliente nuevo (consulta buro), sin ingreso y cuota/ingreso alta.
const SOLICITUDES = [
  { identificacion: '1710000001', montoSolicitado: 800, plazoMeses: 12 },
  { identificacion: '1720000002', montoSolicitado: 450, plazoMeses: 12 },
  { identificacion: '1720000002', montoSolicitado: 1200, plazoMeses: 12 },
  { identificacion: '1730000003', montoSolicitado: 1200, plazoMeses: 12 },
  { identificacion: '1740000004', montoSolicitado: 1200, plazoMeses: 12 },
  { identificacion: '1750000005', montoSolicitado: 1200, plazoMeses: 6 },
];

export default function () {
  const solicitud = SOLICITUDES[Math.floor(Math.random() * SOLICITUDES.length)];
  const headers = { 'Content-Type': 'application/json' };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;

  const res = http.post(
    `${BASE_URL}/v1/evaluaciones-credito`,
    JSON.stringify({ ...solicitud, tiendaId: 'TIENDA-SUR-01' }),
    { headers, tags: { tipo: 'evaluacion' } }
  );

  check(res, {
    'status 200': (r) => r.status === 200,
    'ResultadoPos (aprobado + mensajeParaCliente)': (r) => {
      try {
        const cuerpo = r.json();
        return typeof cuerpo.aprobado === 'boolean' && typeof cuerpo.mensajeParaCliente === 'string';
      } catch (e) {
        return false;
      }
    },
  });

  sleep(1);
}
