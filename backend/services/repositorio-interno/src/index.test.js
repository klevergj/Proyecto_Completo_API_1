const { iniciar } = require("./index");
const { pool } = require("./db/connection");

const configBase = { seedAlIniciar: true, dbInitReintentos: 3, dbInitEsperaMs: 10 };

describe("iniciar (arranque con siembra)", () => {
  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(() => pool.end());

  function dobles(sembrarBase) {
    return {
      sembrarBase,
      escuchar: jest.fn(),
      esperar: jest.fn(async () => {}),
      salir: jest.fn()
    };
  }

  it("reintenta hasta que la siembra funciona y luego escucha", async () => {
    const sembrarBase = jest
      .fn()
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValue({ sembrados: 4 });
    const d = dobles(sembrarBase);

    await iniciar({ config: configBase, ...d });

    expect(sembrarBase).toHaveBeenCalledTimes(3);
    expect(d.esperar).toHaveBeenCalledTimes(2);
    expect(d.esperar).toHaveBeenCalledWith(10);
    expect(d.escuchar).toHaveBeenCalledTimes(1);
    expect(d.salir).not.toHaveBeenCalled();
  });

  it("sale con codigo 1 si se agotan los reintentos y no escucha", async () => {
    const d = dobles(jest.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    await iniciar({ config: configBase, ...d });

    expect(d.sembrarBase).toHaveBeenCalledTimes(3);
    expect(d.salir).toHaveBeenCalledWith(1);
    expect(d.escuchar).not.toHaveBeenCalled();
  });

  it("no siembra si seedAlIniciar es false", async () => {
    const d = dobles(jest.fn());

    await iniciar({ config: { ...configBase, seedAlIniciar: false }, ...d });

    expect(d.sembrarBase).not.toHaveBeenCalled();
    expect(d.escuchar).toHaveBeenCalledTimes(1);
  });
});
