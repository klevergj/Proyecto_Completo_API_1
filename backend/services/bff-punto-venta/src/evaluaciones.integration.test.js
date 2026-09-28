jest.mock("./clients/evaluacionCoreClient");

const request = require("supertest");
const evaluacionCoreClient = require("./clients/evaluacionCoreClient");
const app = require("./index");

const ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const SOLICITUD = { identificacion: "1720000002", montoSolicitado: 450, plazoMeses: 12, tiendaId: "TIENDA-001" };

function decisionCore(id = ID, decision = "APROBADO") {
  return {
    idEvaluacion: id,
    decision,
    motivo: "El cliente registra mora vigente en el historial interno",
    fecha: "2026-09-24T12:00:00.000Z",
    consultaBuroRealizada: false,
    reglasAplicadas: ["REGLA_MORA_VIGENTE"]
  };
}

function errorAxios(props) {
  return Object.assign(new Error("connect ECONNREFUSED 172.18.0.5:8090"), props);
}

describe("BFF Punto de Venta - integracion HTTP", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => console.error.mockRestore());

  it("GET /health responde 200", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "UP", service: "bff-punto-venta" });
  });

  it("POST responde 200 con ResultadoPos de exactamente tres campos", async () => {
    evaluacionCoreClient.solicitarEvaluacion.mockResolvedValue(decisionCore(ID, "RECHAZADO"));

    const res = await request(app).post("/evaluaciones-credito").send({ ...SOLICITUD, referenciaPartner: "X" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ idEvaluacion: ID, aprobado: false, mensajeParaCliente: "Crédito no aprobado en esta ocasión" });
    expect(evaluacionCoreClient.solicitarEvaluacion).toHaveBeenCalledWith(SOLICITUD);
  });

  it("POST con JSON mal formado responde 400 sin llamar al core", async () => {
    const res = await request(app)
      .post("/evaluaciones-credito")
      .set("Content-Type", "application/json")
      .send('{"identificacion": ');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("SOLICITUD_INVALIDA");
    expect(evaluacionCoreClient.solicitarEvaluacion).not.toHaveBeenCalled();
  });

  it("POST con datos invalidos responde 400 nombrando el campo", async () => {
    const res = await request(app).post("/evaluaciones-credito").send({ ...SOLICITUD, plazoMeses: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: "SOLICITUD_INVALIDA",
      message: "El plazo en meses debe ser un número entero mayor que cero",
      reintentable: false
    });
  });

  it.each([
    ["timeout", errorAxios({ code: "ECONNABORTED", request: {} }), 504, "EVALUACION_TIMEOUT"],
    ["core caido", errorAxios({ code: "ECONNREFUSED", request: {} }), 503, "SERVICIO_NO_DISPONIBLE"],
    ["core 500", errorAxios({ response: { status: 500, data: { error: { message: "stack interno", code: "INTERNAL_CORE_ERROR" } } } }), 502, "ERROR_EVALUACION"]
  ])("POST con %s responde %i %s sin filtraciones", async (_caso, error, status, code) => {
    evaluacionCoreClient.solicitarEvaluacion.mockRejectedValue(error);

    const res = await request(app).post("/evaluaciones-credito").send(SOLICITUD);

    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(code);
    expect(res.body.error.reintentable).toBe(true);
    expect(Object.keys(res.body)).toEqual(["error"]);
    expect(JSON.stringify(res.body)).not.toMatch(/ECONNREFUSED|172\.18|stack interno|INTERNAL_CORE_ERROR/);
  });

  it("GET tras POST responde desde cache sin llamar al core", async () => {
    const id = "11111111-2222-4333-8444-555555555555";
    evaluacionCoreClient.solicitarEvaluacion.mockResolvedValue(decisionCore(id, "REVISION_MANUAL"));

    const creado = await request(app).post("/evaluaciones-credito").send(SOLICITUD);
    const consultado = await request(app).get(`/evaluaciones-credito/${id}`);

    expect(consultado.status).toBe(200);
    expect(consultado.body).toEqual(creado.body);
    expect(evaluacionCoreClient.obtenerEvaluacionPorId).not.toHaveBeenCalled();
  });

  it("GET con id no UUID responde 400", async () => {
    const res = await request(app).get("/evaluaciones-credito/abc");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("ID_EVALUACION_INVALIDO");
    expect(evaluacionCoreClient.obtenerEvaluacionPorId).not.toHaveBeenCalled();
  });

  it("GET con miss y core 404 responde 404", async () => {
    evaluacionCoreClient.obtenerEvaluacionPorId.mockRejectedValue(errorAxios({ response: { status: 404, data: {} } }));

    const res = await request(app).get("/evaluaciones-credito/99999999-2222-4333-8444-555555555555");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("EVALUACION_NO_ENCONTRADA");
  });
});
