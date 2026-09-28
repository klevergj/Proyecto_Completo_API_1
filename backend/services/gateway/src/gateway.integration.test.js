const request = require("supertest");
const { levantarJwks, firmarToken } = require("./__helpers__/jwt");
const { levantarBffEco, crearAppPrueba } = require("./__helpers__/entorno");
const { crearAppMetricas } = require("./app");
const { crearGatewayConfig } = require("./config/gatewayConfig");
const { resolverRuta } = require("./routes/tablaRutas");
const { scopesDelToken, identificadorCliente } = require("./utils/scopes");

const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const ESCRITOR = () => `Bearer ${firmarToken({ scope: "evaluaciones:escribir evaluaciones:leer" })}`;

let jwks;
let bff;

beforeAll(async () => {
  jwks = await levantarJwks();
  bff = await levantarBffEco();
});
afterAll(async () => {
  await jwks.cerrar();
  await bff.cerrar();
});

const appNueva = (extra = {}) => crearAppPrueba({ jwksUri: jwks.jwksUri, bffPosUrl: bff.url, bffAuditoriaUrl: bff.url, ...extra });

describe("Gateway - ejemplos", () => {
  beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it("GET /health responde 200 sin token", async () => {
    const res = await request(appNueva().app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "UP", service: "gateway" });
  });

  it("(antes test.failing) POST /v1/evaluaciones-credito llega al BFF POS como /evaluaciones-credito", async () => {
    const res = await request(appNueva().app)
      .post("/v1/evaluaciones-credito")
      .set("Authorization", ESCRITOR())
      .send({ identificacion: "1720000002", montoSolicitado: 450, plazoMeses: 12, tiendaId: "TIENDA-001" });

    expect(res.status).toBe(200);
    expect(res.body.metodo).toBe("POST");
    expect(res.body.ruta).toBe("/evaluaciones-credito");
  });

  it("(antes test.failing) con el BFF POS caido responde 502 JSON", async () => {
    const { app } = appNueva({ bffPosUrl: "http://localhost:1" });
    const res = await request(app).post("/v1/evaluaciones-credito").set("Authorization", ESCRITOR()).send({});

    expect(res.status).toBe(502);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body.error.code).toBe("BFF_NO_DISPONIBLE");
  });

  it("los errores propios del BFF se devuelven tal cual (codigo y cuerpo)", async () => {
    const bff400 = await levantarBffEco({ estado: 400 });
    try {
      const res = await request(appNueva({ bffPosUrl: bff400.url }).app).post("/v1/evaluaciones-credito").set("Authorization", ESCRITOR()).send({});
      expect(res.status).toBe(400);
      expect(res.body.ruta).toBe("/evaluaciones-credito");
    } finally {
      await bff400.cerrar();
    }
  });

  it("JWKS no disponible (clave fuera de cache) responde 503 AUTORIZACION_NO_DISPONIBLE", async () => {
    const { app } = crearAppPrueba({ jwksUri: "http://localhost:1/certs", bffPosUrl: bff.url, bffAuditoriaUrl: bff.url });
    const res = await request(app).get(`/v1/evaluaciones-credito/${UUID}`).set("Authorization", ESCRITOR());

    expect(res.status).toBe(503);
    expect(res.body.error).toMatchObject({ code: "AUTORIZACION_NO_DISPONIBLE", reintentable: true });
  });

  it("el JWKS se consulta una vez y luego se usa la cache", async () => {
    const jwksPropio = await levantarJwks();
    try {
      const { app } = crearAppPrueba({ jwksUri: jwksPropio.jwksUri, bffPosUrl: bff.url, bffAuditoriaUrl: bff.url });
      for (let i = 0; i < 5; i++) {
        await request(app).get(`/v1/evaluaciones-credito/${UUID}`).set("Authorization", ESCRITOR());
      }
      expect(jwksPropio.peticiones()).toBe(1);
    } finally {
      await jwksPropio.cerrar();
    }
  });

  it("X-Request-Id: conserva uno valido, reemplaza uno invalido y lo propaga al BFF", async () => {
    const { app } = appNueva();
    const valido = await request(app).get(`/v1/evaluaciones-credito/${UUID}`).set("Authorization", ESCRITOR()).set("X-Request-Id", "abc-123");
    expect(valido.headers["x-request-id"]).toBe("abc-123");
    expect(valido.body.cabeceras["x-request-id"]).toBe("abc-123");

    const invalido = await request(app).get("/health").set("X-Request-Id", "<script>");
    expect(invalido.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("incluye X-Response-Time y API-Version en respuestas de negocio", async () => {
    const res = await request(appNueva().app).get(`/v1/evaluaciones-credito/${UUID}`).set("Authorization", ESCRITOR());
    expect(res.headers["x-response-time"]).toMatch(/^\d+(\.\d)?ms$/);
    expect(res.headers["api-version"]).toBe("v1");
  });

  it("/metrics se sirve en la app interna, no en la publica", async () => {
    const { app, registroMetricas } = appNueva();
    await request(app).get("/health");
    // La metrica se registra en 'finish' (puede ir detras de la respuesta en el mismo event loop).
    await new Promise((r) => setTimeout(r, 50));

    expect((await request(app).get("/metrics")).status).toBe(404);
    const metricas = await request(crearAppMetricas(registroMetricas)).get("/metrics");
    expect(metricas.status).toBe(200);
    expect(metricas.text).toContain('gateway_http_requests_total{metodo="GET",ruta="/health",codigo="200"} 1');
    expect(metricas.text).toContain("gateway_http_request_duration_seconds_bucket");
  });
});

describe("Gateway - modulos", () => {
  it("la configuracion exige OAuth2", () => {
    expect(() => crearGatewayConfig({ JWT_AUDIENCE: "a", JWKS_URI: "b" })).toThrow("JWT_ISSUER");
    expect(() => crearGatewayConfig({ JWT_ISSUER: "i", JWKS_URI: "b" })).toThrow("JWT_AUDIENCE");
    expect(() => crearGatewayConfig({ JWT_ISSUER: "i", JWT_AUDIENCE: "a" })).toThrow("JWKS_URI");
    const c = crearGatewayConfig({ JWT_ISSUER: "i", JWT_AUDIENCE: "a", JWKS_URI: "j" });
    expect(c).toMatchObject({ bffPosTimeoutMs: 6000, bffAuditoriaTimeoutMs: 4000, rateLimitMax: 100, metricsPort: 9464 });
  });

  it("la Tabla_Rutas ancla las plantillas y re-codifica parametros", () => {
    expect(resolverRuta("GET", "/v1/evaluaciones-credito/abc/extra")).toBeNull();
    expect(resolverRuta("GET", "/evaluaciones-credito/abc")).toBeNull();
    expect(resolverRuta("POST", "/v1/evaluaciones-credito/abc")).toBeNull();
    expect(resolverRuta("GET", "/v1/evaluaciones-credito/%E0%A4%A")).toBeNull(); // % invalido
    expect(resolverRuta("GET", "/v1/auditoria/evaluaciones/..%2F..%2Fadmin/detalle").rutaInternaResuelta).toBe(
      "/evaluaciones/..%2F..%2Fadmin/detalle"
    );
  });

  it("scopes: cadena con espacios o arreglo scp, coincidencia exacta; cliente por azp o client_id", () => {
    expect([...scopesDelToken({ scope: "a  b", scp: ["c"] })].sort()).toEqual(["a", "b", "c"]);
    expect(scopesDelToken({ scope: "evaluaciones:leerx" }).has("evaluaciones:leer")).toBe(false);
    expect(identificadorCliente({ azp: "x", client_id: "y" })).toBe("x");
    expect(identificadorCliente({ client_id: "y" })).toBe("y");
  });
});
