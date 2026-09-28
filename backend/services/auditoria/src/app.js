const express = require("express");
const cors = require("cors");
const { asegurarRegistroAuditoriaRepository } = require("./repositories/registroAuditoriaRepository.interface");
const { crearRegistrosController } = require("./controllers/registrosController");
const { crearRegistrosRoutes } = require("./routes/registrosRoutes");
const { manejadorErrores } = require("./middlewares/manejadorErrores");

/**
 * Construye la aplicacion a partir de sus dependencias (inyeccion).
 *
 * @param {{ registroRepository: Object, verificarAlmacen: () => Promise<boolean>,
 *           config: { paginaTamanoDefecto: number, paginaTamanoMaximo: number }, ahora?: () => Date }} deps
 */
function crearApp({ registroRepository, verificarAlmacen, config, ahora }) {
  const app = express();
  const registrosController = crearRegistrosController({
    registroRepository: asegurarRegistroAuditoriaRepository(registroRepository),
    ahora
  });

  app.use(cors());
  app.use(express.json());

  // Siempre 200 mientras el proceso vive; `almacen` indica si MongoDB responde (Req 5.7).
  app.get("/health", async (req, res) => {
    const disponible = await verificarAlmacen().catch(() => false);
    res.status(200).json({
      status: "UP",
      service: "auditoria",
      almacen: disponible ? "UP" : "DOWN",
      timestamp: new Date().toISOString()
    });
  });

  app.use("/registros", crearRegistrosRoutes(registrosController, config));
  app.use(manejadorErrores);

  return app;
}

module.exports = {
  crearApp
};
