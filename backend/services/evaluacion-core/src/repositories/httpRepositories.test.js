const { crearHttpDatosBuroRepository } = require("./httpDatosBuroRepository");
const { crearHttpHistorialClienteRepository } = require("./httpHistorialClienteRepository");
const DatosBuro = require("../models/datosBuro");
const HistorialCliente = require("../models/historialCliente");

const errorHttp = (status, data = {}) => Object.assign(new Error(`HTTP ${status}`), { response: { status, data } });

describe("httpDatosBuroRepository (Circuit Breaker + normalizacion)", () => {
  beforeEach(() => jest.spyOn(console, "warn").mockImplementation(() => {}));
  afterEach(() => console.warn.mockRestore());

  function repoCon(get, breakerOptions) {
    const repo = crearHttpDatosBuroRepository({ httpClient: { get }, breakerOptions });
    return repo;
  }

  it("normaliza ScoreResponse a DatosBuro DISPONIBLE", async () => {
    const repo = repoCon(jest.fn().mockResolvedValue({ data: { score: 720, moraExterna: false, deudaExternaTotal: 0 } }));
    const d = await repo.obtenerPorIdentificacion("1720000002");

    expect(d).toBeInstanceOf(DatosBuro);
    expect({ ...d }).toEqual({ score: 720, moraExterna: false, deudaExternaTotal: 0, estadoBuro: "DISPONIBLE" });
    repo.breaker.shutdown();
  });

  it("un score fuera de rango se normaliza a null", async () => {
    const repo = repoCon(jest.fn().mockResolvedValue({ data: { score: 999 } }));
    expect((await repo.obtenerPorIdentificacion("x")).score).toBeNull();
    repo.breaker.shutdown();
  });

  it("503 del buro -> fallback INDISPONIBLE sin lanzar (RF-07)", async () => {
    const repo = repoCon(jest.fn().mockRejectedValue(errorHttp(503)));
    expect({ ...(await repo.obtenerPorIdentificacion("x")) }).toEqual({ ...DatosBuro.indisponible() });
    repo.breaker.shutdown();
  });

  it("timeout del buro -> fallback INDISPONIBLE sin lanzar", async () => {
    const repo = repoCon(
      jest.fn(() => new Promise(() => {})),
      { timeout: 20, errorThresholdPercentage: 50, resetTimeout: 10000 }
    );
    expect((await repo.obtenerPorIdentificacion("x")).estadoBuro).toBe("INDISPONIBLE");
    repo.breaker.shutdown();
  });

  it("400 del buro se propaga con su status y code (no es una caida)", async () => {
    const repo = repoCon(jest.fn().mockRejectedValue(errorHttp(400, { error: { code: "INVALID_IDENTIFICACION", message: "vacia" } })));
    await expect(repo.obtenerPorIdentificacion(" ")).rejects.toMatchObject({ status: 400, code: "INVALID_IDENTIFICACION" });
    repo.breaker.shutdown();
  });

  it("con el breaker abierto no llama al buro y devuelve el fallback (RF-07 crit. 5)", async () => {
    const get = jest.fn().mockRejectedValue(errorHttp(503));
    const repo = repoCon(get);
    repo.breaker.open();

    expect((await repo.obtenerPorIdentificacion("x")).estadoBuro).toBe("INDISPONIBLE");
    expect(get).not.toHaveBeenCalled();
    repo.breaker.shutdown();
  });
});

describe("httpHistorialClienteRepository", () => {
  it("200 -> HistorialCliente", async () => {
    const data = { identificacion: "1720000002", tieneMoraVigente: false, creditosPrevios: 6, ingresosDeclarados: 1500, antiguedadMeses: 68 };
    const repo = crearHttpHistorialClienteRepository({ httpClient: { get: jest.fn().mockResolvedValue({ data }) } });

    const h = await repo.buscarPorIdentificacion("1720000002");
    expect(h).toBeInstanceOf(HistorialCliente);
    expect({ ...h }).toEqual(data);
  });

  it("404 -> null (cliente nuevo)", async () => {
    const repo = crearHttpHistorialClienteRepository({ httpClient: { get: jest.fn().mockRejectedValue(errorHttp(404)) } });
    expect(await repo.buscarPorIdentificacion("1730000003")).toBeNull();
  });

  it("otro error se propaga", async () => {
    const repo = crearHttpHistorialClienteRepository({ httpClient: { get: jest.fn().mockRejectedValue(errorHttp(503)) } });
    await expect(repo.buscarPorIdentificacion("x")).rejects.toThrow("HTTP 503");
  });
});
