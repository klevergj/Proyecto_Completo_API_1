const { MongoClient } = require("mongodb");

/**
 * Crea el cliente de MongoDB con timeouts cortos (Req 5.4). La cadena de
 * conexion llega solo por configuracion (sin credenciales en el codigo).
 *
 * @param {{ mongoUri: string, dbName: string, mongoTimeoutMs: number }} config
 * @returns {{ client: MongoClient, db: import("mongodb").Db,
 *             verificarConexion: () => Promise<boolean>, cerrar: () => Promise<void> }}
 */
function crearClienteMongo({ mongoUri, dbName, mongoTimeoutMs }) {
  const client = new MongoClient(mongoUri, {
    serverSelectionTimeoutMS: mongoTimeoutMs,
    connectTimeoutMS: mongoTimeoutMs
  });
  const db = client.db(dbName);

  async function verificarConexion() {
    try {
      await db.command({ ping: 1 }, { maxTimeMS: mongoTimeoutMs });
      return true;
    } catch (error) {
      return false;
    }
  }

  return {
    client,
    db,
    verificarConexion,
    cerrar: () => client.close()
  };
}

module.exports = {
  crearClienteMongo
};
