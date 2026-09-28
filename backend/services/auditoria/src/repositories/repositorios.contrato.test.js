const { ejecutarContratoRepositorio } = require("./registroAuditoriaRepository.contrato");
const { crearMemoriaRegistroAuditoriaRepository } = require("./memoriaRegistroAuditoriaRepository");
const { crearMongoRegistroAuditoriaRepository, COLECCION } = require("./mongoRegistroAuditoriaRepository");
const { crearClienteMongo } = require("../db/mongoCliente");

// Implementacion en memoria: siempre.
ejecutarContratoRepositorio("memoria", {
  crear: async () => crearMemoriaRegistroAuditoriaRepository()
});

// Implementacion MongoDB: solo si hay una base de pruebas disponible
// (p. ej. MONGO_URI_TEST=mongodb://localhost:27018 con `docker run mongo:7`).
if (process.env.MONGO_URI_TEST) {
  const mongo = crearClienteMongo({
    mongoUri: process.env.MONGO_URI_TEST,
    dbName: `auditoria_test_${process.pid}`,
    mongoTimeoutMs: 5000
  });

  ejecutarContratoRepositorio("mongodb", {
    crear: async () => crearMongoRegistroAuditoriaRepository({ db: mongo.db, mongoTimeoutMs: 5000 }),
    limpiar: async () => {
      await mongo.db.collection(COLECCION).deleteMany({});
    },
    cerrar: async () => {
      await mongo.db.dropDatabase();
      await mongo.cerrar();
    }
  });
} else {
  describe.skip("Contrato de RegistroAuditoriaRepository: mongodb (definir MONGO_URI_TEST)", () => {
    it("omitido", () => {});
  });
}
