const fs = require("fs");
const YAML = require("yamljs");

/**
 * Carga el contrato OpenAPI desde contracts/ (ruta de buroConfig). Si no se
 * puede leer/parsear no tumba el arranque: devuelve null y avisa en log.
 *
 * @param {string} ruta
 * @returns {{ documento: Object, contenido: string } | null}
 */
function cargarContratoOpenApi(ruta) {
  try {
    const contenido = fs.readFileSync(ruta, "utf8");
    return { documento: YAML.parse(contenido), contenido };
  } catch (err) {
    console.warn(`[Buro Simulado] No se pudo cargar el contrato OpenAPI (${ruta}): ${err.message}`);
    return null;
  }
}

module.exports = {
  cargarContratoOpenApi
};
