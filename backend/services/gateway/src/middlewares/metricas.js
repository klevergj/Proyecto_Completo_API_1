const { identificadorCliente } = require("../utils/scopes");

/**
 * Etiqueta de ruta de baja cardinalidad (Req 6.2): plantilla de la Tabla_Rutas,
 * "/health", "/docs" (todos sus recursos), "/openapi.yaml" o "no_encontrada".
 * Nunca identificadores ni query strings.
 */
function etiquetaRuta(req) {
  if (req.ruta) return req.ruta.plantilla;
  if (req.path === "/health") return "/health";
  if (req.originalUrl.startsWith("/docs")) return "/docs";
  if (req.path === "/openapi.yaml") return "/openapi.yaml";
  return "no_encontrada";
}

/**
 * Middleware de metricas por peticion (Req 6): mide desde la entrada hasta el
 * 'finish' de la respuesta, incluidas las rechazadas (401/403/404/429).
 *
 * @param {{ registroMetricas: { duracion: Object, peticiones: Object }, registrar?: (linea: string) => void }} deps
 */
function crearMetricas({ registroMetricas, registrar = (linea) => process.stdout.write(`${linea}\n`) }) {
  return function metricas(req, res, next) {
    const inicio = process.hrtime.bigint();
    const msTranscurridos = () => Number(process.hrtime.bigint() - inicio) / 1e6;

    // X-Response-Time debe fijarse antes de enviar cabeceras (Req 6.5).
    const writeHeadOriginal = res.writeHead;
    res.writeHead = function writeHeadConLatencia(...args) {
      if (!res.headersSent) {
        res.setHeader("X-Response-Time", `${msTranscurridos().toFixed(1)}ms`);
      }
      return writeHeadOriginal.apply(this, args);
    };

    res.on("finish", () => {
      const latenciaMs = msTranscurridos();
      const etiquetas = { metodo: req.method, ruta: etiquetaRuta(req), codigo: String(res.statusCode) };
      registroMetricas.duracion.observe(etiquetas, latenciaMs / 1000);
      registroMetricas.peticiones.inc(etiquetas);

      // Log estructurado sin token ni cuerpo (Req 6.4).
      registrar(
        JSON.stringify({
          tipo: "acceso",
          requestId: req.idSolicitud,
          clientId: req.auth ? identificadorCliente(req.auth) : null,
          metodo: etiquetas.metodo,
          ruta: etiquetas.ruta,
          codigo: res.statusCode,
          latenciaMs: Number(latenciaMs.toFixed(1)),
          fecha: new Date().toISOString()
        })
      );
    });

    next();
  };
}

module.exports = {
  crearMetricas,
  etiquetaRuta
};
