const express = require("express");
const swaggerUi = require("swagger-ui-express");
const { contratoNoDisponible } = require("../utils/errorBuro");

/**
 * Documentacion del contrato: Swagger UI en /docs (solo si el contrato se
 * cargo) y el YAML crudo en /openapi.yaml (404 si no esta disponible).
 * @param {{ documento: Object, contenido: string } | null} contrato
 */
function crearDocsRoutes(contrato) {
  const router = express.Router();

  if (contrato) {
    router.use(
      "/docs",
      swaggerUi.serve,
      swaggerUi.setup(contrato.documento, { customSiteTitle: "Buro Simulado - API Docs" })
    );
  }

  router.get("/openapi.yaml", (req, res, next) => {
    if (!contrato) {
      return next(contratoNoDisponible());
    }
    return res.type("text/yaml").send(contrato.contenido);
  });

  return router;
}

module.exports = {
  crearDocsRoutes
};
