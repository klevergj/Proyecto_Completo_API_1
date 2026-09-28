const request = require("supertest");
const { levantarBffEco, crearAppPrueba } = require("./__helpers__/entorno");
const { crearGatewayConfig } = require("./config/gatewayConfig");

const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

let bffPos;
let bffAuditoria;

beforeAll(async () => {
  bffPos = await levantarBffEco();
  bffAuditoria = await levantarBffEco();
});
afterAll(async () => {
  await bffPos.cerrar();
  await bffAuditoria.cerrar();
});

const appSinAuth = (extra = {}) =>
  crearAppPrueba({ jwksUri: "http://no-usado", bffPosUrl: bffPos.url, bffAuditoriaUrl: bffAuditoria.url, authHabilitada: false, ...extra }).app;

describe("Gateway con AUTH_HABILITADA=false (modo temporal)", () => {
  it("responde 200 en /oauth/token con grant_type client_credentials", async () => {
    const app = appSinAuth();
    const res = await request(app)
      .post("/oauth/token")
      .send({ grant_type: "client_credentials", client_id: "frontend-tiendas", client_secret: "secret-key-resuelve" });
    expect(res.status).toBe(200);
    expect(res.body.access_token).toBeDefined();
    expect(res.body.token_type).toBe("Bearer");
  });

  it("reenvia sin token a los cuatro endpoints /v1, sin verificar scopes", async () => {
    const app = appSinAuth();

    const post = await request(app).post("/v1/evaluaciones-credito").send({ identificacion: "1720000002" });
    expect(post.status).toBe(200);
    expect(post.body.ruta).toBe("/evaluaciones-credito");
    expect(post.body.cabeceras["x-client-id"]).toBe("anonimo");

    expect((await request(app).get(`/v1/evaluaciones-credito/${UUID}`)).body.ruta).toBe(`/evaluaciones-credito/${UUID}`);
    expect((await request(app).get("/v1/auditoria/evaluaciones?page=0&size=5")).body.ruta).toBe("/evaluaciones?page=0&size=5");
    expect((await request(app).get(`/v1/auditoria/evaluaciones/${UUID}/detalle`)).body.ruta).toBe(`/evaluaciones/${UUID}/detalle`);
  });

  it("un token presente se ignora y no se reenvia", async () => {
    const res = await request(appSinAuth()).get(`/v1/evaluaciones-credito/${UUID}`).set("Authorization", "Bearer cualquier-cosa");
    expect(res.status).toBe(200);
    expect(res.body.cabeceras.authorization).toBeUndefined();
  });

  it("mantiene /v1 (404 sin version), metricas y API-Version", async () => {
    const app = appSinAuth();
    expect((await request(app).post("/evaluaciones-credito").send({})).status).toBe(404);
    const res = await request(app).get(`/v1/evaluaciones-credito/${UUID}`);
    expect(res.headers["api-version"]).toBe("v1");
    expect(res.headers["x-response-time"]).toBeDefined();
  });

  it("el limite de tasa se aplica por IP", async () => {
    const app = appSinAuth({ rateLimitMax: 2 });
    await request(app).get(`/v1/evaluaciones-credito/${UUID}`);
    await request(app).get(`/v1/evaluaciones-credito/${UUID}`);
    const excedida = await request(app).get(`/v1/evaluaciones-credito/${UUID}`);
    expect(excedida.status).toBe(429);
    expect(excedida.body.error.code).toBe("LIMITE_TASA_EXCEDIDO");
  });
});

describe("AUTH_HABILITADA en la configuracion", () => {
  it("solo el valor 'false' desactiva OAuth2 y entonces no exige JWT_*", () => {
    expect(crearGatewayConfig({ AUTH_HABILITADA: "false" })).toMatchObject({ authHabilitada: false, jwtIssuer: null });
    expect(crearGatewayConfig({ AUTH_HABILITADA: "FALSE" }).authHabilitada).toBe(false);
  });

  it("sin la variable (u otro valor) la autenticacion queda activa y exige JWT_*", () => {
    expect(() => crearGatewayConfig({})).toThrow("JWT_ISSUER");
    expect(() => crearGatewayConfig({ AUTH_HABILITADA: "no" })).toThrow("JWT_ISSUER");
    expect(crearGatewayConfig({ JWT_ISSUER: "i", JWT_AUDIENCE: "a", JWKS_URI: "j" }).authHabilitada).toBe(true);
  });
});
