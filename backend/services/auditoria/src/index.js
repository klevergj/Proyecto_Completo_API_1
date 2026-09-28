require("dotenv").config();
const auditoriaConfig = require("./config/auditoriaConfig");
const { crearClienteMongo } = require("./db/mongoCliente");
const { crearMongoRegistroAuditoriaRepository } = require("./repositories/mongoRegistroAuditoriaRepository");
const { crearApp } = require("./app");

// Composicion: aqui se elige la implementacion concreta del repositorio.
const mongo = crearClienteMongo(auditoriaConfig);
const registroRepository = crearMongoRegistroAuditoriaRepository({
  db: mongo.db,
  mongoTimeoutMs: auditoriaConfig.mongoTimeoutMs
});

const app = crearApp({
  registroRepository,
  verificarAlmacen: mongo.verificarConexion,
  config: auditoriaConfig
});

/**
 * Arranque: crea los indices con reintentos acotados antes de aceptar
 * peticiones (Req 5.3). Si se agotan, sale con codigo 1 y Docker reinicia.
 * Dependencias inyectables para probar los reintentos sin MongoDB.
 */
async function iniciar({
  config = auditoriaConfig,
  inicializar = () => registroRepository.inicializar(),
  escuchar = () => app.listen(config.port, () => console.log(`[Auditoria] Servidor escuchando en el puerto ${config.port}`)),
  esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  salir = (codigo) => process.exit(codigo)
} = {}) {
  for (let intento = 1; intento <= config.dbInitReintentos; intento++) {
    try {
      await inicializar();
      console.log("[Auditoria] Indices de MongoDB listos.");
      return escuchar();
    } catch (error) {
      console.warn(`[Auditoria] MongoDB no disponible (intento ${intento}/${config.dbInitReintentos}): ${error.name}`);
      if (intento === config.dbInitReintentos) {
        console.error("[Auditoria] Se agotaron los reintentos para inicializar MongoDB.");
        return salir(1);
      }
      await esperar(config.dbInitEsperaMs);
    }
  }
  return undefined;
}

if (process.env.NODE_ENV !== "test") {
  iniciar();
}

module.exports = app;
module.exports.iniciar = iniciar;
module.exports.mongo = mongo;
