const express = require("express");
const cors = require("cors");
const { crearScoreService } = require("./services/scoreService");
const { crearEscenarioService } = require("./services/escenarioService");
const { crearScoreController } = require("./controllers/scoreController");
const { crearAdminController } = require("./controllers/adminController");
const { crearScoreRoutes } = require("./routes/scoreRoutes");
const { crearAdminRoutes } = require("./routes/adminRoutes");
const { crearDocsRoutes } = require("./routes/docsRoutes");
const { manejadorErrores } = require("./middlewares/manejadorErrores");

/**
 * Construye la aplicacion a partir de sus dependencias (inyeccion).
 *
 * @param {{ escenarioRepository: Object, latenciaMs: number,
 *           esperar?: (ms: number) => Promise<void>,
 *           contrato?: { documento: Object, contenido: string } | null }} deps
 */
function crearApp({ escenarioRepository, latenciaMs, esperar, contrato = null }) {
  const app = express();

  const scoreController = crearScoreController({
    scoreService: crearScoreService({ escenarioRepository, latenciaMs, esperar })
  });
  const adminController = crearAdminController({
    escenarioService: crearEscenarioService({ escenarioRepository })
  });

  app.use(cors());
  app.use(express.json());

  app.get("/health", (req, res) => {
    res.status(200).json({ status: "UP", service: "buro-simulado", timestamp: new Date().toISOString() });
  });

  app.use("/score", crearScoreRoutes(scoreController));
  app.use("/admin", crearAdminRoutes(adminController));
  app.use(crearDocsRoutes(contrato));
  app.use(manejadorErrores);

  return app;
}

module.exports = {
  crearApp
};
