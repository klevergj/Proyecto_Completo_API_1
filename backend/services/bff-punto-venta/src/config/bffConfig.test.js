const VARIABLES = ["EVALUACION_CORE_URL", "CORE_TIMEOUT_MS", "CACHE_TTL_MS", "CACHE_MAX_ENTRADAS"];

function cargarConfig(env) {
  jest.resetModules();
  for (const nombre of VARIABLES) delete process.env[nombre];
  Object.assign(process.env, env);
  return require("./bffConfig");
}

describe("bffConfig", () => {
  const envOriginal = { ...process.env };

  beforeEach(() => jest.spyOn(console, "warn").mockImplementation(() => {}));
  afterEach(() => {
    console.warn.mockRestore();
    process.env = { ...envOriginal };
  });

  it("usa los defaults cuando no hay variables", () => {
    const config = cargarConfig({});
    expect(config.coreUrl).toBe("http://evaluacion-core:8090");
    expect(config.coreTimeoutMs).toBe(5000);
    expect(config.cacheTtlMs).toBe(900000);
    expect(config.cacheMaxEntradas).toBe(1000);
  });

  it("lee valores validos del entorno", () => {
    const config = cargarConfig({
      EVALUACION_CORE_URL: "http://localhost:8090",
      CORE_TIMEOUT_MS: "2500",
      CACHE_TTL_MS: "60000",
      CACHE_MAX_ENTRADAS: "50"
    });
    expect(config.coreUrl).toBe("http://localhost:8090");
    expect(config.coreTimeoutMs).toBe(2500);
    expect(config.cacheTtlMs).toBe(60000);
    expect(config.cacheMaxEntradas).toBe(50);
  });

  it("reemplaza valores invalidos por el default y advierte", () => {
    const config = cargarConfig({ CORE_TIMEOUT_MS: "abc", CACHE_TTL_MS: "-1", CACHE_MAX_ENTRADAS: "10.5" });
    expect(config.coreTimeoutMs).toBe(5000);
    expect(config.cacheTtlMs).toBe(900000);
    expect(config.cacheMaxEntradas).toBe(1000);
    expect(console.warn).toHaveBeenCalledTimes(3);
  });
});
