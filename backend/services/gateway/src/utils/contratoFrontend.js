const fs = require("fs");
const YAML = require("yaml");

/**
 * Carga el contrato del Frontend (contracts/spec0-frontend.yaml). Si no se
 * puede leer o parsear, no tumba el arranque: devuelve null y avisa en log
 * (/docs y /openapi.yaml responderan 404).
 *
 * @param {string} ruta
 * @returns {{ documento: Object, contenido: string } | null}
 */
function cargarContratoFrontend(ruta) {
  try {
    const contenido = fs.readFileSync(ruta, "utf8");
    return { documento: YAML.parse(contenido), contenido };
  } catch (error) {
    console.warn(`[Gateway] No se pudo cargar el contrato del Frontend (${ruta}): ${error.message}`);
    return null;
  }
}

module.exports = {
  cargarContratoFrontend
};
