const path = require("path");
const request = require("supertest");
const YAML = require("yaml");
const { crearApp } = require("./app");
const { crearRegistroMetricas } = require("./utils/registroMetricas");
const { cargarContratoFrontend } = require("./utils/contratoFrontend");
const { crearGatewayConfig } = require("./config/gatewayConfig");
const { TABLA_RUTAS } = require("./routes/tablaRutas");

const CONFIG = {
  authHabilitada: true,
  jwtIssuer: "http://emisor",
  jwtAudience: "resuelve-api",
  jwksUri: "http://localhost:1/certs",
  jwksTimeoutMs: 500,
  bffPosUrl: "http://localhost:1",
  bffPosTimeoutMs: 500,
  bffAuditoriaUrl: "http://localhost:1",
  bffAuditoriaTimeoutMs: 500,
  rateLimitWindowMs: 60000,
  rateLimitMax: 100
};

// Ruta por defecto de la configuracion: contracts/spec0-frontend.yaml del repo.
const RUTA_SPEC0 = crearGatewayConfig({ AUTH_HABILITADA: "false" }).contratoFrontendPath;
const contrato = cargarContratoFrontend(RUTA_SPEC0);

const appCon = (contratoFrontend) =>
  crearApp({ config: CONFIG, registroMetricas: crearRegistroMetricas(), registrarAcceso: () => {}, contratoFrontend });

describe("Contrato del Frontend (spec0) servido por el Gateway", () => {
  it("la ruta por defecto apunta a contracts/spec0-frontend.yaml y el archivo se carga", () => {
    expect(path.basename(RUTA_SPEC0)).toBe("spec0-frontend.yaml");
    expect(contrato).not.toBeNull();
    expect(contrato.documento.info.title).toBe("Contrato Frontend - Resuelve");
  });

  it("spec0 esta alineado con la Tabla_Rutas: cada endpoint publico existe en el contrato", () => {
    const paths = contrato.documento.paths;
    for (const ruta of TABLA_RUTAS) {
      const pathContrato = ruta.plantilla.replace(/^\/v1/, "").replace(":id", "{id}");
      expect(paths[pathContrato]).toBeDefined();
      expect(paths[pathContrato][ruta.metodo.toLowerCase()]).toBeDefined();
    }
  });

  it("spec0 es autocontenido (sin $ref a otros archivos)", () => {
    expect(contrato.contenido).not.toMatch(/\$ref:\s*['"]?\.\//);
  });

  it("GET /openapi.yaml devuelve el YAML sin token", async () => {
    const res = await request(appCon(contrato)).get("/openapi.yaml");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/yaml/);
    expect(YAML.parse(res.text).info.title).toBe("Contrato Frontend - Resuelve");
  });

  it("GET /docs/ sirve Swagger UI sin token", async () => {
    const res = await request(appCon(contrato)).get("/docs/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("swagger-ui");
  });

  it("sin contrato cargado, /openapi.yaml responde 404 y /docs no existe", async () => {
    const app = appCon(null);
    const yaml = await request(app).get("/openapi.yaml");
    expect(yaml.status).toBe(404);
    expect(yaml.body.error.code).toBe("RUTA_NO_ENCONTRADA");
    expect((await request(app).get("/docs/")).status).toBe(404);
  });

  it("un archivo inexistente no tumba el arranque", () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    expect(cargarContratoFrontend("/no/existe.yaml")).toBeNull();
    console.warn.mockRestore();
  });
});
