const VARIABLES = [
  "DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME", "DB_POOL_MAX",
  "DB_CONEXION_TIMEOUT_MS", "DB_CONSULTA_TIMEOUT_MS", "SEED_AL_INICIAR",
  "DB_INIT_REINTENTOS", "DB_INIT_ESPERA_MS"
];

function cargarConfig(env) {
  jest.resetModules();
  for (const nombre of VARIABLES) delete process.env[nombre];
  Object.assign(process.env, env);
  return require("./repoConfig");
}

describe("repoConfig", () => {
  const envOriginal = { ...process.env };

  beforeEach(() => jest.spyOn(console, "warn").mockImplementation(() => {}));
  afterEach(() => {
    console.warn.mockRestore();
    process.env = { ...envOriginal };
  });

  it("usa los defaults cuando no hay variables", () => {
    const config = cargarConfig({});
    expect(config.db).toEqual({ host: "postgres", port: 5432, user: "resuelve_user", password: "resuelve_pass", database: "resuelve_db" });
    expect(config.dbPoolMax).toBe(10);
    expect(config.dbConexionTimeoutMs).toBe(1500);
    expect(config.dbConsultaTimeoutMs).toBe(2000);
    expect(config.seedAlIniciar).toBe(true);
    expect(config.dbInitReintentos).toBe(10);
    expect(config.dbInitEsperaMs).toBe(2000);
  });

  it("los timeouts por defecto suman menos que los 4000 ms del adaptador del core", () => {
    const config = cargarConfig({});
    expect(config.dbConexionTimeoutMs + config.dbConsultaTimeoutMs).toBeLessThan(4000);
  });

  it("lee valores validos del entorno", () => {
    const config = cargarConfig({ DB_HOST: "localhost", DB_PORT: "5433", DB_POOL_MAX: "4", SEED_AL_INICIAR: "false" });
    expect(config.db.host).toBe("localhost");
    expect(config.db.port).toBe(5433);
    expect(config.dbPoolMax).toBe(4);
    expect(config.seedAlIniciar).toBe(false);
  });

  it("solo el valor 'false' desactiva la siembra", () => {
    expect(cargarConfig({ SEED_AL_INICIAR: "FALSE" }).seedAlIniciar).toBe(false);
    expect(cargarConfig({ SEED_AL_INICIAR: "no" }).seedAlIniciar).toBe(true);
  });

  it("reemplaza valores invalidos por el default y advierte", () => {
    const config = cargarConfig({ DB_POOL_MAX: "2.5", DB_CONSULTA_TIMEOUT_MS: "-1", DB_INIT_REINTENTOS: "abc" });
    expect(config.dbPoolMax).toBe(10);
    expect(config.dbConsultaTimeoutMs).toBe(2000);
    expect(config.dbInitReintentos).toBe(10);
    expect(console.warn).toHaveBeenCalledTimes(3);
  });
});
