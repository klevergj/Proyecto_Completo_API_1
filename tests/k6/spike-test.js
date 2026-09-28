import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 20 },   // Carga inicial baja
    { duration: '30s', target: 500 },  // Pico extremo (Spike) a 500 VUs
    { duration: '1m', target: 500 },   // Mantener pico a 500 VUs
    { duration: '20s', target: 0 },    // Bajada rápida
  ],
  thresholds: {
    http_req_failed: ['rate<0.15'],    // Tolerancia a fallos durante el pico < 15%
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:8080';

export function setup() {
  const authPayload = JSON.stringify({
    grant_type: 'client_credentials',
    client_id: 'k6-spike-test',
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
    montoSolicitado: 2500,
    plazoMeses: 24,
    tiendaId: 'STORE-SPIKE-TEST'
  });

  const res = http.post(`${BASE_URL}/v1/evaluaciones-credito`, payload, params);

  check(res, {
    'status es 200 o 429': (r) => r.status === 200 || r.status === 429,
  });

  sleep(0.5);
}
