const express = require("express");
const swaggerUi = require("swagger-ui-express");
const { rutaNoEncontrada } = require("../utils/errorGateway");

/**
 * Documentacion del contrato que consume el Frontend (spec0, generado desde
 * spec1): Swagger UI en /docs y YAML en /openapi.yaml. Publicos y sin token:
 * describen la API, no exponen datos.
 *
 * @param {{ documento: Object, contenido: string } | null} contrato
 */
function crearDocsRoutes(contrato) {
  const router = express.Router();

  if (contrato) {
    router.use(
      "/docs",
      swaggerUi.serve,
      swaggerUi.setup(contrato.documento, {
        customSiteTitle: "Resuelve API - Contrato Frontend",
        swaggerOptions: { persistAuthorization: true }
      })
    );
  }

  router.get("/openapi.yaml", (req, res, next) => {
    if (!contrato) {
      return next(rutaNoEncontrada());
    }
    return res.type("text/yaml").send(contrato.contenido);
  });

  return router;
}

module.exports = {
  crearDocsRoutes
};
