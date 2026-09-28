const fc = require("fast-check");
const request = require("supertest");
const { crearApp } = require("./app");
const { crearPostgresHistorialRepository, filaAClienteHistorial } = require("./repositories/postgresHistorialRepository");
const { toHistorialClienteDto } = require("./dtos/historialClienteDto");
const { crearBaseEnMemoria, insertarRegistro } = require("./__helpers__/baseEnMemoria");

const AHORA = new Date("2026-09-24T12:00:00Z");
const arbIdentificacion = fc.stringMatching(/^[0-9A-Za-z-]{1,20}$/);

const arbRegistro = fc.record({
  identificacion: arbIdentificacion,
  tiene_mora_vigente: fc.boolean(),
  creditos_previos: fc.nat({ max: 1000 }),
  ingresos_declarados: fc.option(fc.integer({ min: 1, max: 99999999999 }).map((c) => c / 100), { nil: null }),
  fecha_primer_registro: fc
    .date({ min: new Date("1990-01-01T00:00:00Z"), max: new Date("2035-12-31T00:00:00Z"), noInvalidDate: true })
    .map((d) => d.toISOString().slice(0, 10))
});

async function appConBase() {
  const pool = await crearBaseEnMemoria();
  const app = crearApp({
    historialRepository: crearPostgresHistorialRepository({ pool }),
    verificarConexion: async () => true,
    ahora: () => AHORA
  });
  return { app, pool };
}

describe("Repositorio Interno - integracion HTTP", () => {
  beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => console.error.mockRestore());

  // Feature: repositorio-interno, Property 3: Ida y vuelta por la base de datos
  it("Property 3: ida y vuelta por la base de datos", async () => {
    await fc.assert(
      fc.asyncProperty(arbRegistro, async (registro) => {
        const { app, pool } = await appConBase();
        await insertarRegistro(pool, registro);

        const res = await request(app).get(`/clientes/${registro.identificacion}/historial`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual(toHistorialClienteDto(filaAClienteHistorial(registro), AHORA));
      }),
      { numRuns: 100 }
    );
  });

  // Feature: repositorio-interno, Property 4: Una identificación sin historial responde 404, nunca 200
  it("Property 4: una identificacion sin historial responde 404, nunca 200", async () => {
    const { app, pool } = await appConBase();
    await insertarRegistro(pool, {
      identificacion: "EXISTE-1",
      tiene_mora_vigente: false,
      creditos_previos: 1,
      ingresos_declarados: 1000,
      fecha_primer_registro: "2020-01-01"
    });

    await fc.assert(
      fc.asyncProperty(arbIdentificacion.filter((id) => id !== "EXISTE-1"), async (id) => {
        const res = await request(app).get(`/clientes/${id}/historial`);

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: { code: "CLIENTE_NO_ENCONTRADO", message: "El cliente no tiene historial interno" } });
      }),
      { numRuns: 100 }
    );
  });

  // Feature: repositorio-interno, Property 5: Una identificación con formato inválido responde 400 sin consultar la base
  it("Property 5: una identificacion con formato invalido responde 400 sin consultar la base", async () => {
    const historialRepository = { buscarPorIdentificacion: jest.fn() };
    const app = crearApp({ historialRepository, verificarConexion: async () => true });

    const arbInvalida = fc.oneof(
      fc.constantFrom(" ", "   "),
      fc.stringMatching(/^[0-9A-Za-z-]{21,40}$/),
      fc
        .tuple(fc.stringMatching(/^[0-9A-Za-z-]{0,9}$/), fc.constantFrom("'", ";", "_", ".", "@", "ñ", "*", "(", "\"", "$"), fc.stringMatching(/^[0-9A-Za-z-]{0,9}$/))
        .map(([a, c, b]) => a + c + b)
    );

    await fc.assert(
      fc.asyncProperty(arbInvalida, async (id) => {
        const res = await request(app).get(`/clientes/${encodeURIComponent(id)}/historial`);

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("IDENTIFICACION_INVALIDA");
      }),
      { numRuns: 100 }
    );
    expect(historialRepository.buscarPorIdentificacion).not.toHaveBeenCalled();
  });

  it("aplica trim a la identificacion antes de buscar", async () => {
    const historialRepository = { buscarPorIdentificacion: jest.fn(async () => null) };
    const app = crearApp({ historialRepository, verificarConexion: async () => true });
    await request(app).get(`/clientes/${encodeURIComponent(" 1720000002 ")}/historial`);
    expect(historialRepository.buscarPorIdentificacion).toHaveBeenCalledWith("1720000002");
  });

  describe("errores de base de datos", () => {
    it("base no disponible -> 503 sin filtraciones", async () => {
      const error = Object.assign(new Error("connect ECONNREFUSED 10.0.0.5:5432"), { code: "ECONNREFUSED" });
      const app = crearApp({
        historialRepository: { buscarPorIdentificacion: jest.fn().mockRejectedValue(error) },
        verificarConexion: async () => false
      });

      const res = await request(app).get("/clientes/1720000002/historial");

      expect(res.status).toBe(503);
      expect(res.body).toEqual({
        error: { code: "REPOSITORIO_NO_DISPONIBLE", message: "El repositorio interno no está disponible temporalmente" }
      });
    });

    it("consulta cancelada por statement_timeout -> 503", async () => {
      const error = Object.assign(new Error("canceling statement due to statement timeout"), { code: "57014" });
      const app = crearApp({
        historialRepository: { buscarPorIdentificacion: jest.fn().mockRejectedValue(error) },
        verificarConexion: async () => true
      });
      expect((await request(app).get("/clientes/1720000002/historial")).status).toBe(503);
    });

    it("error no previsto -> 500 sin filtraciones", async () => {
      const error = Object.assign(new Error('relation "clientes_historial" does not exist'), { code: "42P01" });
      const app = crearApp({
        historialRepository: { buscarPorIdentificacion: jest.fn().mockRejectedValue(error) },
        verificarConexion: async () => true
      });

      const res = await request(app).get("/clientes/1720000002/historial");

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: { code: "ERROR_INTERNO", message: "Error interno en el repositorio" } });
    });
  });

  describe("GET /health", () => {
    it("responde 200 con la base UP", async () => {
      const { app } = await appConBase();
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: "UP", service: "repositorio-interno", database: "UP" });
    });

    it("responde 200 con la base DOWN sin fallar", async () => {
      const app = crearApp({
        historialRepository: { buscarPorIdentificacion: jest.fn() },
        verificarConexion: async () => {
          throw new Error("sin conexion");
        }
      });
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body.database).toBe("DOWN");
    });
  });
});
