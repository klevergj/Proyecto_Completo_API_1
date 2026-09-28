const express = require("express");
const cors = require("cors");
const { asegurarHistorialRepository } = require("./repositories/historialRepository.interface");
const { crearHistorialController } = require("./controllers/historialController");
const { crearHistorialRoutes } = require("./routes/historialRoutes");
const { manejadorErrores } = require("./middlewares/manejadorErrores");

/**
 * Construye la aplicacion a partir de sus dependencias (inyeccion): recibe
 * cualquier implementacion de HistorialRepository, lo que permite probar con
 * pg-mem o con dobles sin tocar PostgreSQL.
 *
 * @param {{ historialRepository: Object, verificarConexion: () => Promise<boolean>, ahora?: () => Date }} deps
 */
function crearApp({ historialRepository, verificarConexion, ahora }) {
  const app = express();
  const historialController = crearHistorialController({
    historialRepository: asegurarHistorialRepository(historialRepository),
    ahora
  });

  app.use(cors());
  app.use(express.json());

  // Health check: siempre 200; informa por separado el estado de la base para
  // distinguir "proceso vivo" de "base caida" (Req 4 crit. 6).
  app.get("/health", async (req, res) => {
    const baseDisponible = await verificarConexion().catch(() => false);
    res.status(200).json({
      status: "UP",
      service: "repositorio-interno",
      database: baseDisponible ? "UP" : "DOWN",
      timestamp: new Date().toISOString()
    });
  });

  app.use("/", crearHistorialRoutes(historialController));
  app.use(manejadorErrores);

  return app;
}

module.exports = {
  crearApp
};
