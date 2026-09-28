import { spawn } from 'child_process';
import path from 'path';

const services = [
  { name: 'buro-simulado', port: 8091, script: './services/buro-simulado/src/server.js' },
  { name: 'repositorio-interno', port: 8092, script: './services/repositorio-interno/src/server.js' },
  { name: 'servicio-auditoria', port: 8095, script: './services/servicio-auditoria/src/server.js' },
  { name: 'servicio-evaluacion', port: 8090, script: './services/servicio-evaluacion/src/server.js' },
  { name: 'bff-pos', port: 8081, script: './services/bff-pos/src/server.js' },
  { name: 'bff-auditoria', port: 8082, script: './services/bff-auditoria/src/server.js' },
  { name: 'api-gateway', port: 8080, script: './services/api-gateway/src/server.js' },
];

const processes = [];

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startService(svc) {
  const fullPath = path.resolve(svc.script);
  console.log(`Starting ${svc.name} (${svc.port})...`);
  const child = spawn('node', [fullPath], {
    stdio: 'inherit',
    cwd: path.resolve('.'),
    env: { ...process.env, PORT: svc.port.toString() }
  });
  processes.push(child);
}

async function runTests() {
  console.log('--- STARTING MICROSERVICES TEST ---');
  for (const svc of services) {
    startService(svc);
  }

  // Wait 3 seconds for all servers to spin up
  await sleep(3000);

  try {
    // 1. Test OAuth2 Token Generation on Gateway (:8080)
    console.log('\n1. Testing OAuth2 Token Generation...');
    const tokenRes = await fetch('http://localhost:8080/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'client_credentials', client_id: 'test-client' })
    });
    const tokenData = await tokenRes.json();
    console.log('Token response:', tokenData);
    if (!tokenData.access_token) throw new Error('Failed to get access_token');
    const token = tokenData.access_token;

    // 2. Test Normal Credit Evaluation (ID: 0102030405) via Gateway -> BFF POS -> Core -> Buró & Repo
    console.log('\n2. Testing Credit Evaluation (Normal Aprobado)...');
    const evalRes = await fetch('http://localhost:8080/v1/evaluaciones-credito', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        identificacion: '0102030405',
        montoSolicitado: 1200,
        plazoMeses: 12,
        tiendaId: 'CENTRO-SUR-01'
      })
    });
    const evalData = await evalRes.json();
    console.log('Eval response:', evalData);
    if (!evalData.idEvaluacion || evalData.decision !== 'APROBADO' || evalData.aprobado !== true) {
      throw new Error('Eval response mismatch');
    }

    // 3. Test Internal Mora Rejection (ID ends with 99)
    console.log('\n3. Testing Credit Evaluation (Internal Mora Rejection)...');
    const moraRes = await fetch('http://localhost:8080/v1/evaluaciones-credito', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        identificacion: '12345699',
        montoSolicitado: 500,
        plazoMeses: 6
      })
    });
    const moraData = await moraRes.json();
    console.log('Mora response:', moraData);
    if (moraData.decision !== 'RECHAZADO' || moraData.consultaBuroRealizada !== false) {
      throw new Error('Internal mora response mismatch');
    }

    // 4. Test Mandatory Admin Scenario Endpoint on Buró Simulado (POST /admin/escenario)
    console.log('\n4. Testing POST /admin/escenario on Buró Simulado...');
    const adminRes = await fetch('http://localhost:8091/admin/escenario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modo: 'CAIDO', latenciaMs: 3000 })
    });
    console.log('Admin escenario status:', adminRes.status);
    if (adminRes.status !== 204) throw new Error('Admin endpoint failed');

    // 5. Test Circuit Breaker Fallback when Buró is CAIDO
    console.log('\n5. Testing Circuit Breaker Fallback (Buró CAIDO)...');
    const caidoRes = await fetch('http://localhost:8080/v1/evaluaciones-credito', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        identificacion: '0102030405',
        montoSolicitado: 1000,
        plazoMeses: 12
      })
    });
    const caidoData = await caidoRes.json();
    console.log('Caido response:', caidoData);
    if (caidoData.decision !== 'REVISION_MANUAL' || !caidoData.motivo.includes('Circuit Breaker')) {
      throw new Error('Circuit Breaker fallback failed');
    }

    // Restore Buró to NORMAL
    await fetch('http://localhost:8091/admin/escenario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modo: 'NORMAL' })
    });

    // 6. Test BFF Auditoría listing via Gateway
    console.log('\n6. Testing BFF Auditoría via Gateway...');
    const auditRes = await fetch('http://localhost:8080/v1/auditoria/evaluaciones', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const auditData = await auditRes.json();
    console.log('Audit page response:', auditData);
    if (auditData.total < 3) throw new Error('Audit records count mismatch');

    console.log('\n✅ ALL INTEGRATION TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('\n❌ INTEGRATION TEST FAILED:', err);
  } finally {
    console.log('Cleaning up microservice processes...');
    for (const proc of processes) {
      proc.kill('SIGTERM');
    }
  }
}

runTests();
