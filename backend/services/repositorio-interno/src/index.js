require("dotenv").config();
const repoConfig = require("./config/repoConfig");
const { pool, verificarConexion } = require("./db/connection");
const { sembrar } = require("./db/seed");
const { crearPostgresHistorialRepository } = require("./repositories/postgresHistorialRepository");
const { crearApp } = require("./app");

const PORT = process.env.PORT || 8092;

// Composicion: aqui se elige la implementacion concreta del repositorio.
const app = crearApp({
  historialRepository: crearPostgresHistorialRepository({ pool }),
  verificarConexion: () => verificarConexion(pool)
});

/**
 * Arranque: si seedAlIniciar, siembra con reintentos acotados antes de aceptar
 * peticiones (RF-03 crit. 6-7). Si se agotan los intentos, sale con codigo 1 y
 * Docker reinicia el contenedor (restart: unless-stopped).
 *
 * Las dependencias se inyectan para poder probar los reintentos sin base real.
 */
async function iniciar({
  config = repoConfig,
  sembrarBase = () => sembrar(pool),
  escuchar = () => app.listen(PORT, () => console.log(`[Repositorio Interno] Servidor escuchando en el puerto ${PORT}`)),
  esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  salir = (codigo) => process.exit(codigo)
} = {}) {
  if (config.seedAlIniciar) {
    for (let intento = 1; intento <= config.dbInitReintentos; intento++) {
      try {
        const { sembrados } = await sembrarBase();
        console.log(`[Repositorio Interno] Esquema y datos semilla listos (${sembrados} registros).`);
        break;
      } catch (error) {
        console.warn(
          `[Repositorio Interno] Siembra fallida (intento ${intento}/${config.dbInitReintentos}): ${error.message}`
        );
        if (intento === config.dbInitReintentos) {
          console.error("[Repositorio Interno] Base de datos no disponible; se agotaron los reintentos.");
          return salir(1);
        }
        await esperar(config.dbInitEsperaMs);
      }
    }
  }
  return escuchar();
}

if (process.env.NODE_ENV !== "test") {
  iniciar();
}

module.exports = app;
module.exports.iniciar = iniciar;
