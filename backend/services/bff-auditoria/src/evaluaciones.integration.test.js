const request = require("supertest");
const { crearApp } = require("./app");
const { crearHttpRegistroAuditoriaRepository } = require("./repositories/httpRegistroAuditoriaRepository");
const { crearBffAuditoriaConfig } = require("./config/bffAuditoriaConfig");

const CONFIG = { paginaTamanoDefecto: 20, paginaTamanoMaximo: 100 };
const ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const REGISTRO = {
  idEvaluacion: ID,
  identificacion: "1730000003",
  montoSolicitado: 1200,
  plazoMeses: 12,
  tiendaId: "TIENDA-001",
  decision: "REVISION_MANUAL",
  motivo: "Cliente nuevo con buen score",
  fecha: "2026-09-24T12:00:00.000Z",
  consultaBuroRealizada: true,
  scoreBuro: 742,
  reglasAplicadas: ["REGLA_MORA_VIGENTE", "REGLA_CAPACIDAD_PAGO", "REGLA_SCORE_BURO", "REGLA_CLIENTE_NUEVO"],
  registradoEn: "2026-09-24T12:00:00.120Z"
};

const errorHttp = (status) => Object.assign(new Error(`Request failed with status code ${status}`), { response: { status, data: { error: { message: "interno" } } } });

function appConHttp(get) {
  return crearApp({ registroRepository: crearHttpRegistroAuditoriaRepository({ httpClient: { get } }), config: CONFIG });
}

describe("BFF Auditoria - ejemplos", () => {
  beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it("GET /health responde 200", async () => {
    const res = await request(appConHttp(jest.fn())).get("/health");
    expect(res.body).toMatchObject({ status: "UP", service: "bff-auditoria" });
  });

  it("GET /evaluaciones pide a auditoria con page 0 / size 20 y responde la pagina de resumenes", async () => {
    const get = jest.fn().mockResolvedValue({ data: { total: 41, page: 0, size: 20, items: [REGISTRO] } });

    const res = await request(appConHttp(get)).get("/evaluaciones?estado=REVISION_MANUAL&tiendaId=TIENDA-001&otro=x");

    expect(get).toHaveBeenCalledWith("/registros", { params: { estado: "REVISION_MANUAL", tiendaId: "TIENDA-001", page: 0, size: 20 } });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      total: 41,
      page: 0,
      size: 20,
      totalPaginas: 3,
      items: [{ idEvaluacion: ID, fecha: REGISTRO.fecha, decision: "REVISION_MANUAL", tiendaId: "TIENDA-001", consultaBuroRealizada: true }]
    });
  });

  it("GET /evaluaciones/{id}/detalle expone score, reglas y consulta al buro", async () => {
    const get = jest.fn().mockResolvedValue({ data: REGISTRO });
    const res = await request(appConHttp(get)).get(`/evaluaciones/${ID}/detalle`);

    expect(get).toHaveBeenCalledWith(`/registros/${ID}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ...REGISTRO });
  });

  it("detalle inexistente -> 404 EVALUACION_NO_ENCONTRADA; id no UUID -> 400 sin llamar", async () => {
    const get = jest.fn().mockRejectedValue(errorHttp(404));
    const app = appConHttp(get);

    const noExiste = await request(app).get(`/evaluaciones/${ID}/detalle`);
    expect(noExiste.status).toBe(404);
    expect(noExiste.body.error).toEqual({ code: "EVALUACION_NO_ENCONTRADA", message: "No encontramos esa evaluacion en auditoria", reintentable: false });

    get.mockClear();
    const invalido = await request(app).get("/evaluaciones/abc/detalle");
    expect(invalido.status).toBe(400);
    expect(get).not.toHaveBeenCalled();
  });

  it.each([
    ["timeout", Object.assign(new Error("timeout of 3000ms exceeded"), { code: "ECONNABORTED", request: {} }), 504, "AUDITORIA_TIMEOUT"],
    ["caido", Object.assign(new Error("connect ECONNREFUSED 172.18.0.9:8095"), { code: "ECONNREFUSED", request: {} }), 503, "SERVICIO_NO_DISPONIBLE"],
    ["503 del almacen", errorHttp(503), 503, "SERVICIO_NO_DISPONIBLE"],
    ["500", errorHttp(500), 502, "ERROR_AUDITORIA"]
  ])("auditoria %s -> %i %s sin filtraciones", async (_caso, error, status, code) => {
    const res = await request(appConHttp(jest.fn().mockRejectedValue(error))).get("/evaluaciones");
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(code);
    expect(res.body.error.reintentable).toBe(true);
    expect(JSON.stringify(res.body)).not.toMatch(/ECONNREFUSED|172\.18|interno|status code/);
  });

  it("una respuesta de auditoria fuera de Spec 7 -> 502 ERROR_AUDITORIA", async () => {
    const listado = await request(appConHttp(jest.fn().mockResolvedValue({ data: { total: "x", items: null } }))).get("/evaluaciones");
    expect(listado.status).toBe(502);

    const detalle = await request(appConHttp(jest.fn().mockResolvedValue({ data: { idEvaluacion: ID } }))).get(`/evaluaciones/${ID}/detalle`);
    expect(detalle.status).toBe(502);
    expect(detalle.body.error.code).toBe("ERROR_AUDITORIA");
  });

  it("crearApp rechaza un repositorio que no cumple la interfaz", () => {
    expect(() => crearApp({ registroRepository: { buscar: jest.fn() }, config: CONFIG })).toThrow(
      'RegistroAuditoriaRepository invalido: falta el metodo "buscarPorId"'
    );
  });

  it("configuracion: defaults y defecto > maximo", () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    expect(crearBffAuditoriaConfig({})).toMatchObject({ auditoriaTimeoutMs: 3000, paginaTamanoDefecto: 20, paginaTamanoMaximo: 100 });
    expect(crearBffAuditoriaConfig({ PAGINA_TAMANO_DEFECTO: "80", PAGINA_TAMANO_MAXIMO: "50" })).toMatchObject({ paginaTamanoDefecto: 20, paginaTamanoMaximo: 100 });
  });
});
