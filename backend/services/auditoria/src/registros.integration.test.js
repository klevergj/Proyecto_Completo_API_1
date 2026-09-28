const request = require("supertest");
const { crearApp } = require("./app");
const { crearMemoriaRegistroAuditoriaRepository } = require("./repositories/memoriaRegistroAuditoriaRepository");

const CONFIG = { paginaTamanoDefecto: 20, paginaTamanoMaximo: 100 };
const REGISTRO = {
  idEvaluacion: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
  identificacion: "1720000002",
  montoSolicitado: 450,
  plazoMeses: 12,
  tiendaId: "TIENDA-001",
  decision: "APROBADO",
  motivo: "Monto bajo",
  fecha: "2026-09-24T12:00:00.000Z",
  consultaBuroRealizada: false,
  scoreBuro: null,
  reglasAplicadas: ["REGLA_MORA_VIGENTE", "REGLA_CAPACIDAD_PAGO"]
};

describe("Servicio de Auditoria - ejemplos", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  const appCon = (repo, verificarAlmacen = async () => true) =>
    crearApp({ registroRepository: repo, verificarAlmacen, config: CONFIG });

  it("GET /health informa el almacen UP y DOWN sin fallar", async () => {
    const up = await request(appCon(crearMemoriaRegistroAuditoriaRepository())).get("/health");
    expect(up.body).toMatchObject({ status: "UP", service: "auditoria", almacen: "UP" });

    const down = await request(appCon(crearMemoriaRegistroAuditoriaRepository(), async () => { throw new Error("x"); })).get("/health");
    expect(down.status).toBe(200);
    expect(down.body.almacen).toBe("DOWN");
  });

  it("GET /registros sin parametros usa page 0 y size 20", async () => {
    const res = await request(appCon(crearMemoriaRegistroAuditoriaRepository())).get("/registros");
    expect(res.body).toEqual({ total: 0, page: 0, size: 20, items: [] });
  });

  it("GET /registros/{id} inexistente responde 404 y con id no UUID responde 400", async () => {
    const app = appCon(crearMemoriaRegistroAuditoriaRepository());
    expect((await request(app).get(`/registros/${REGISTRO.idEvaluacion}`)).body.error.code).toBe("REGISTRO_NO_ENCONTRADO");
    const invalido = await request(app).get("/registros/abc");
    expect(invalido.status).toBe(400);
    expect(invalido.body.error.code).toBe("PARAMETRO_INVALIDO");
  });

  it("JSON mal formado responde 400 REGISTRO_INVALIDO", async () => {
    const res = await request(appCon(crearMemoriaRegistroAuditoriaRepository()))
      .post("/registros").set("Content-Type", "application/json").send('{"idEvaluacion": ');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("REGISTRO_INVALIDO");
  });

  it("MongoDB caido responde 503 sin filtrar el mensaje del driver", async () => {
    const error = Object.assign(new Error("connect ECONNREFUSED mongodb+srv://user:pass@cluster0"), { name: "MongoServerSelectionError" });
    const repo = { inicializar: jest.fn(), guardar: jest.fn().mockRejectedValue(error), buscarPorId: jest.fn(), buscar: jest.fn() };

    const res = await request(appCon(repo)).post("/registros").send(REGISTRO);

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: { code: "ALMACEN_NO_DISPONIBLE", message: "El almacen de auditoria no esta disponible temporalmente" } });
  });

  it("no existen rutas de modificacion ni borrado (registro inmutable)", async () => {
    const app = appCon(crearMemoriaRegistroAuditoriaRepository());
    expect((await request(app).put(`/registros/${REGISTRO.idEvaluacion}`).send(REGISTRO)).status).toBe(404);
    expect((await request(app).delete(`/registros/${REGISTRO.idEvaluacion}`)).status).toBe(404);
  });

  it("crearApp rechaza un repositorio incompleto", () => {
    expect(() => appCon({ guardar: jest.fn() })).toThrow('RegistroAuditoriaRepository invalido: falta el metodo "inicializar"');
  });
});

describe("iniciar (indices con reintentos)", () => {
  const { iniciar, mongo } = require("./index");
  const config = { dbInitReintentos: 3, dbInitEsperaMs: 1, port: 0 };

  beforeEach(() => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(() => mongo.cerrar());

  it("reintenta hasta que MongoDB responde y luego escucha", async () => {
    const inicializar = jest.fn().mockRejectedValueOnce(new Error("x")).mockResolvedValue();
    const escuchar = jest.fn();
    const salir = jest.fn();

    await iniciar({ config, inicializar, escuchar, esperar: async () => {}, salir });

    expect(inicializar).toHaveBeenCalledTimes(2);
    expect(escuchar).toHaveBeenCalledTimes(1);
    expect(salir).not.toHaveBeenCalled();
  });

  it("sale con codigo 1 si se agotan los reintentos", async () => {
    const escuchar = jest.fn();
    const salir = jest.fn();

    await iniciar({ config, inicializar: jest.fn().mockRejectedValue(new Error("x")), escuchar, esperar: async () => {}, salir });

    expect(salir).toHaveBeenCalledWith(1);
    expect(escuchar).not.toHaveBeenCalled();
  });
});
