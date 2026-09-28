/**
 * Tabla_Rutas: definicion declarativa de los endpoints publicos (Req 2.1, 4, 5.3).
 *
 * Cada entrada fija metodo, ruta publica versionada, scope requerido, destino
 * y como construir la ruta interna del BFF. Agregar /v2 es agregar entradas
 * con version "v2" sin tocar las de /v1.
 */

const SCOPES = Object.freeze({
  ESCRIBIR_EVALUACIONES: "evaluaciones:escribir",
  LEER_EVALUACIONES: "evaluaciones:leer",
  LEER_AUDITORIA: "auditoria:leer"
});

const TABLA_RUTAS = Object.freeze([
  {
    version: "v1",
    metodo: "POST",
    plantilla: "/v1/evaluaciones-credito",
    scope: SCOPES.ESCRIBIR_EVALUACIONES,
    destino: "bffPos",
    rutaInterna: () => "/evaluaciones-credito"
  },
  {
    version: "v1",
    metodo: "GET",
    plantilla: "/v1/evaluaciones-credito/:id",
    scope: SCOPES.LEER_EVALUACIONES,
    destino: "bffPos",
    rutaInterna: ({ id }) => `/evaluaciones-credito/${encodeURIComponent(id)}`
  },
  {
    version: "v1",
    metodo: "GET",
    plantilla: "/v1/auditoria/evaluaciones",
    scope: SCOPES.LEER_AUDITORIA,
    destino: "bffAuditoria",
    rutaInterna: () => "/evaluaciones"
  },
  {
    version: "v1",
    metodo: "GET",
    plantilla: "/v1/auditoria/evaluaciones/:id/detalle",
    scope: SCOPES.LEER_AUDITORIA,
    destino: "bffAuditoria",
    rutaInterna: ({ id }) => `/evaluaciones/${encodeURIComponent(id)}/detalle`
  }
]);

/**
 * Compila una plantilla "/v1/x/:id" a una expresion regular anclada.
 * Cada parametro captura un unico segmento (sin "/").
 */
function compilarPlantilla(plantilla) {
  const nombres = [];
  const patron = plantilla
    .split("/")
    .map((segmento) => {
      if (segmento.startsWith(":")) {
        nombres.push(segmento.slice(1));
        return "([^/]+)";
      }
      return segmento.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return { regex: new RegExp(`^${patron}$`), nombres };
}

const RUTAS_COMPILADAS = TABLA_RUTAS.map((ruta) => ({ ...ruta, ...compilarPlantilla(ruta.plantilla) }));

/**
 * Busca la ruta publica en la tabla.
 * @param {string} metodo
 * @param {string} rutaPublica ruta sin query string (req.path)
 * @returns {null | { version, metodo, plantilla, scope, destino, params, rutaInternaResuelta }}
 */
function resolverRuta(metodo, rutaPublica) {
  for (const ruta of RUTAS_COMPILADAS) {
    if (ruta.metodo !== metodo) continue;
    const coincidencia = ruta.regex.exec(rutaPublica);
    if (!coincidencia) continue;

    const params = {};
    try {
      ruta.nombres.forEach((nombre, i) => {
        params[nombre] = decodeURIComponent(coincidencia[i + 1]);
      });
    } catch (error) {
      return null; // codificacion % invalida: no es una ruta valida
    }

    return {
      version: ruta.version,
      metodo: ruta.metodo,
      plantilla: ruta.plantilla,
      scope: ruta.scope,
      destino: ruta.destino,
      params,
      rutaInternaResuelta: ruta.rutaInterna(params)
    };
  }
  return null;
}

module.exports = {
  SCOPES,
  TABLA_RUTAS,
  resolverRuta
};
