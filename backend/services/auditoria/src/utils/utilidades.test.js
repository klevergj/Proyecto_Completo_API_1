const fc = require("fast-check");
const { esFechaIsoValida, inicioDiaUtc, inicioDiaSiguienteUtc, esFechaHoraIsoValida } = require("./fechas");
const { clasificarErrorAlmacen, ErrorAuditoria, registroDuplicado } = require("./errorAuditoria");
const { crearAuditoriaConfig, DEFAULTS } = require("../config/auditoriaConfig");

describe("fechas", () => {
  it.each([["2026-09-24", true], ["2024-02-29", true], ["2026-02-29", false], ["2026-02-30", false], ["2026-13-01", false], ["2026-9-1", false], [20260924, false]])(
    "esFechaIsoValida(%p) = %p",
    (valor, esperado) => expect(esFechaIsoValida(valor)).toBe(esperado)
  );

  it("los limites de dia son UTC y el final es exclusivo del dia siguiente", () => {
    expect(inicioDiaUtc("2026-09-24").toISOString()).toBe("2026-09-24T00:00:00.000Z");
    expect(inicioDiaSiguienteUtc("2026-12-31").toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it.each([["2026-09-24T12:00:00.000Z", true], ["2026-09-24T12:00:00-05:00", true], ["2026-09-24", false], ["hoy", false]])(
    "esFechaHoraIsoValida(%p) = %p",
    (valor, esperado) => expect(esFechaHoraIsoValida(valor)).toBe(esperado)
  );
});

describe("clasificarErrorAlmacen", () => {
  // Feature: servicio-auditoria, Property 7: Todo fallo del almacén se traduce sin filtraciones
  it("Property 7: todo fallo del almacen se traduce sin filtraciones", () => {
    const CLASES_DISPONIBILIDAD = ["MongoServerSelectionError", "MongoNetworkError", "MongoNetworkTimeoutError", "MongoNotConnectedError", "MongoTopologyClosedError"];
    const MARCA = "SECRETO-";

    fc.assert(
      fc.property(
        fc.oneof(fc.constantFrom(...CLASES_DISPONIBILIDAD), fc.constantFrom("MongoServerError", "TypeError", "Error")),
        fc.option(fc.oneof(fc.constant(50), fc.integer({ min: 1, max: 20000 })), { nil: undefined }),
        fc.string(),
        (nombre, code, resto) => {
          const error = new Error(`${MARCA} mongodb+srv://user:pass@cluster0.example.net ${resto}`);
          error.name = nombre;
          if (code !== undefined) error.code = code;

          const clasificado = clasificarErrorAlmacen(error);
          const respuesta = clasificado.toRespuesta();
          const esDisponibilidad = CLASES_DISPONIBILIDAD.includes(nombre) || code === 50;

          expect(Object.keys(respuesta)).toEqual(["error"]);
          expect(Object.keys(respuesta.error).sort()).toEqual(["code", "message"]);
          expect(clasificado.status).toBe(esDisponibilidad ? 503 : 500);
          expect(respuesta.error.code).toBe(esDisponibilidad ? "ALMACEN_NO_DISPONIBLE" : "ERROR_INTERNO");
          expect(JSON.stringify(respuesta)).not.toMatch(/SECRETO-|mongodb\+srv|pass@|cluster0/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("un ErrorAuditoria se devuelve tal cual", () => {
    const e = registroDuplicado();
    expect(clasificarErrorAlmacen(e)).toBe(e);
    expect(e).toBeInstanceOf(ErrorAuditoria);
  });
});

describe("auditoriaConfig", () => {
  beforeEach(() => jest.spyOn(console, "warn").mockImplementation(() => {}));
  afterEach(() => console.warn.mockRestore());

  it("usa defaults sin credenciales", () => {
    const c = crearAuditoriaConfig({});
    expect(c.mongoUri).toBe("mongodb://localhost:27017");
    expect(c.paginaTamanoDefecto).toBe(20);
    expect(c.paginaTamanoMaximo).toBe(100);
    expect(c.mongoTimeoutMs).toBe(2000);
  });

  it("si el defecto supera al maximo usa 20/100 y advierte", () => {
    const c = crearAuditoriaConfig({ PAGINA_TAMANO_DEFECTO: "50", PAGINA_TAMANO_MAXIMO: "10" });
    expect([c.paginaTamanoDefecto, c.paginaTamanoMaximo]).toEqual([DEFAULTS.paginaTamanoDefecto, DEFAULTS.paginaTamanoMaximo]);
    expect(console.warn).toHaveBeenCalled();
  });

  it("valores invalidos usan el default", () => {
    const c = crearAuditoriaConfig({ PAGINA_TAMANO_MAXIMO: "abc", MONGO_TIMEOUT_MS: "-1" });
    expect(c.paginaTamanoMaximo).toBe(100);
    expect(c.mongoTimeoutMs).toBe(2000);
  });

  it("lee valores validos del entorno", () => {
    const c = crearAuditoriaConfig({ MONGO_URI: "mongodb://mongo:27017", PAGINA_TAMANO_DEFECTO: "10", PAGINA_TAMANO_MAXIMO: "50" });
    expect(c.mongoUri).toBe("mongodb://mongo:27017");
    expect([c.paginaTamanoDefecto, c.paginaTamanoMaximo]).toEqual([10, 50]);
  });
});
