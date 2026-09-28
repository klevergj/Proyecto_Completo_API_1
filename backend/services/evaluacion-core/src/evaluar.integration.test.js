const request = require("supertest");
const { crearApp } = require("./app");
const { crearAuditoriaPublisher } = require("./clients/auditoriaPublisher");
const HistorialCliente = require("./models/historialCliente");
const DatosBuro = require("./models/datosBuro");

const SOLICITUD = { identificacion: "1720000002", montoSolicitado: 450, plazoMeses: 12, tiendaId: "TIENDA-001" };

function appCon({ historial = null, datosBuro = DatosBuro.indisponible(), auditoriaPublisher } = {}) {
  return crearApp({
    historialClienteRepository: { buscarPorIdentificacion: jest.fn(async () => historial) },
    datosBuroRepository: { obtenerPorIdentificacion: jest.fn(async () => datosBuro) },
    auditoriaPublisher: auditoriaPublisher || { publicarEvento: jest.fn() }
  });
}

describe("evaluacion-core - integracion HTTP", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it("GET /health responde 200", async () => {
    const res = await request(appCon()).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.service).toBe("evaluacion-core");
  });

  it("POST /evaluar responde la DecisionCore del contrato spec4", async () => {
    const historial = new HistorialCliente({ identificacion: "1720000002", tieneMoraVigente: false, creditosPrevios: 6, ingresosDeclarados: 1500, antiguedadMeses: 68 });
    const res = await request(appCon({ historial })).post("/evaluar").send(SOLICITUD);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      decision: "APROBADO",
      consultaBuroRealizada: false,
      reglasAplicadas: ["REGLA_MORA_VIGENTE", "REGLA_CAPACIDAD_PAGO"]
    });
  });

  it.each([
    ["identificacion vacia", { ...SOLICITUD, identificacion: "  " }, "INVALID_IDENTIFICACION"],
    ["monto no positivo", { ...SOLICITUD, montoSolicitado: 0 }, "INVALID_REQUEST"],
    ["plazo decimal", { ...SOLICITUD, plazoMeses: 1.5 }, "INVALID_REQUEST"]
  ])("POST /evaluar con %s responde 400 %s sin evaluar", async (_caso, body, code) => {
    const res = await request(appCon()).post("/evaluar").send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(code);
  });

  it("con la auditoria caida la respuesta sigue siendo 200 (fire-and-forget, RF-08 crit. 3)", async () => {
    const auditoriaPublisher = crearAuditoriaPublisher({
      httpClient: { post: jest.fn().mockRejectedValue(new Error("auditoria caida")) }
    });
    const res = await request(appCon({ auditoriaPublisher })).post("/evaluar").send(SOLICITUD);

    expect(res.status).toBe(200);
    expect(res.body.decision).toBe("REVISION_MANUAL");
  });

  it("GET /evaluaciones/:id conserva el placeholder actual", async () => {
    const res = await request(appCon()).get("/evaluaciones/abc");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ idEvaluacion: "abc", status: "COMPLETADA" });
  });
});
