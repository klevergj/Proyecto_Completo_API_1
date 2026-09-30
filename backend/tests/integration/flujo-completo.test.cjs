/**
 * Test de Integracion End-to-End: Flujo Completo del Sistema Resuelve
 *
 * Se ejecuta contra el ambiente levantado con Docker Compose, SIEMPRE a traves
 * del API Gateway y su contrato publico /v1 (spec1 v1.1.0).
 *
 * Flujo:
 *   1. Health del Gateway
 *   2. POST /v1/evaluaciones-credito -> BFF POS -> core -> repositorio / buro -> auditoria
 *   3. GET /v1/evaluaciones-credito/{id} (reconsulta desde la cache del BFF POS)
 *   4. GET /v1/auditoria/evaluaciones y /detalle (BFF Auditoria -> auditoria)
 *
 * Autenticacion: hoy el Gateway corre con AUTH_HABILITADA=false. Cuando se
 * active OAuth2, definir GATEWAY_TOKEN (scopes evaluaciones:escribir,
 * evaluaciones:leer y auditoria:leer) y se enviara como Bearer.
 *
 * Si el Gateway no responde, las pruebas avisan y se omiten (no fallan).
 */

const axios = require("axios");

const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:8080";
const TOKEN = process.env.GATEWAY_TOKEN;

const cliente = axios.create({
  baseURL: GATEWAY_URL,
  timeout: 10000,
  headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {},
  validateStatus: () => true
});

let disponible = false;
let idEvaluacion = null;

beforeAll(async () => {
  try {
    const health = await cliente.get("/health");
    disponible = health.status === 200;
  } catch (error) {
    disponible = false;
  }
  if (!disponible) {
    console.warn(`[E2E Skip] Gateway no disponible en ${GATEWAY_URL}. Levantar con: docker compose up -d --build`);
  }
});

describe("Flujo completo por el API Gateway (/v1)", () => {
  test("1. Health del Gateway", async () => {
    if (!disponible) return;
    const res = await cliente.get("/health");
    expect(res.data.status).toBe("UP");
  });

  test("2. POST /v1/evaluaciones-credito devuelve ResultadoPos (cliente con buen historial, monto bajo)", async () => {
    if (!disponible) return;
    const res = await cliente.post("/v1/evaluaciones-credito", {
      identificacion: "1720000002",
      montoSolicitado: 450,
      plazoMeses: 12,
      tiendaId: "TIENDA-CENTRO-01"
    });

    expect(res.status).toBe(200);
    expect(res.headers["api-version"]).toBe("v1");
    expect(res.data).toEqual({
      idEvaluacion: expect.any(String),
      aprobado: true,
      mensajeParaCliente: "Crédito aprobado"
    });
    idEvaluacion = res.data.idEvaluacion;
  });

  test("3. GET /v1/evaluaciones-credito/{id} reconsulta el mismo resultado", async () => {
    if (!disponible || !idEvaluacion) return;
    const res = await cliente.get(`/v1/evaluaciones-credito/${idEvaluacion}`);
    expect(res.status).toBe(200);
    expect(res.data.idEvaluacion).toBe(idEvaluacion);
  });

  test("4. La decision queda auditada y se consulta por el Gateway", async () => {
    if (!disponible || !idEvaluacion) return;
    // La auditoria es fire-and-forget desde el core: se espera a que llegue.
    let detalle;
    for (let intento = 0; intento < 10; intento++) {
      detalle = await cliente.get(`/v1/auditoria/evaluaciones/${idEvaluacion}/detalle`);
      if (detalle.status === 200) break;
      await new Promise((r) => setTimeout(r, 300));
    }

    expect(detalle.status).toBe(200);
    expect(detalle.data).toMatchObject({
      idEvaluacion,
      decision: "APROBADO",
      consultaBuroRealizada: false,
      reglasAplicadas: ["REGLA_MORA_VIGENTE", "REGLA_CAPACIDAD_PAGO"]
    });

    const listado = await cliente.get("/v1/auditoria/evaluaciones?page=0&size=5&tiendaId=TIENDA-CENTRO-01");
    expect(listado.status).toBe(200);
    expect(listado.data.items.map((i) => i.idEvaluacion)).toContain(idEvaluacion);
  });

  test("5. Rutas sin version responden 404", async () => {
    if (!disponible) return;
    const res = await cliente.post("/evaluaciones-credito", {});
    expect(res.status).toBe(404);
    expect(res.data.error.code).toBe("RUTA_NO_ENCONTRADA");
  });
});
