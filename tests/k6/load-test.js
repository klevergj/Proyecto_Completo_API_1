import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },  // Ramp-up a 50 VUs
    { duration: '1m', target: 150 },  // Ramp-up a 150 VUs
    { duration: '2m', target: 150 },  // Carga sostenida a 150 VUs
    { duration: '30s', target: 0 },   // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% de peticiones por debajo de 2s
    http_req_failed: ['rate<0.05'],    // Menos de 5% de errores
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:8080';

export function setup() {
  // Obtener Token OAuth2
  const authPayload = JSON.stringify({
    grant_type: 'client_credentials',
    client_id: 'k6-load-test',
    client_secret: 'secret'
  });

  const params = {
    headers: { 'Content-Type': 'application/json' },
  };

  const res = http.post(`${BASE_URL}/oauth/token`, authPayload, params);
  const token = res.json('access_token');
  return { token };
}

export default function (data) {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${data.token}`,
    },
  };

  const payload = JSON.stringify({
    identificacion: '0203040506',
    montoSolicitado: 1200,
    plazoMeses: 12,
    tiendaId: 'STORE-K6-TEST'
  });

  const res = http.post(`${BASE_URL}/v1/evaluaciones-credito`, payload, params);

  check(res, {
    'status es 200': (r) => r.status === 200,
    'respuesta contiene idEvaluacion': (r) => r.json('idEvaluacion') !== undefined,
  });

  sleep(1);
}
