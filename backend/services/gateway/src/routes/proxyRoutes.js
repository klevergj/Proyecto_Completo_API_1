const { createProxyMiddleware } = require("http-proxy-middleware");
const { identificadorCliente } = require("../utils/scopes");
const { bffNoDisponible, bffTimeout } = require("../utils/errorGateway");

/**
 * Query string original ("?a=1&b=2" o "").
 */
function queryOriginal(req) {
  const i = req.originalUrl.indexOf("?");
  return i >= 0 ? req.originalUrl.slice(i) : "";
}

/**
 * Crea el proxy hacia un BFF (Req 4). Sin logica de negocio ni transformacion
 * de cuerpos (steering tech.md).
 *
 * Correccion del defecto de http-proxy-middleware 3.x: la ruta interna se
 * toma de la Tabla_Rutas (req.ruta.rutaInternaResuelta) y no del prefijo
 * montado, y los errores usan la API v3 (`on.error`).
 *
 * El timeout se controla aqui (no con `proxyTimeout`) para distinguir un BFF
 * lento (504) de uno caido (502).
 *
 * @param {{ target: string, timeoutMs: number }} destino
 */
function crearProxyDestino({ target, timeoutMs }) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    xfwd: true,
    pathRewrite: (_ruta, req) => req.ruta.rutaInternaResuelta + queryOriginal(req),
    on: {
      proxyReq: (proxyReq, req) => {
        // Req 1.6: el token no sale del Gateway; la identidad viaja como X-Client-Id.
        proxyReq.removeHeader("authorization");
        proxyReq.setHeader("X-Client-Id", req.auth ? identificadorCliente(req.auth) : "anonimo");
        proxyReq.setHeader("X-Request-Id", req.idSolicitud);
        // Si el timeout vence sin haber conectado, el BFF no esta disponible
        // (502); si ya conecto y no responde, esta lento (504). Cuando se emite
        // proxyReq el socket suele estar ya asignado, por eso se revisa primero.
        const vigilarConexion = (socket) => {
          if (!socket.connecting) {
            req.bffConectado = true;
          } else {
            socket.once("connect", () => {
              req.bffConectado = true;
            });
          }
        };
        if (proxyReq.socket) vigilarConexion(proxyReq.socket);
        else proxyReq.once("socket", vigilarConexion);
        proxyReq.setTimeout(timeoutMs, () => {
          req.proxyTimeout = Boolean(req.bffConectado);
          proxyReq.destroy(new Error("Timeout hacia el BFF"));
        });
      },
      proxyRes: (proxyRes) => {
        // Req 5.4: version del contrato publico; el cuerpo y el codigo del BFF no se tocan.
        proxyRes.headers["api-version"] = "v1";
      },
      error: (err, req, res) => {
        const error = req.proxyTimeout ? bffTimeout() : bffNoDisponible();
        console.error(`[Gateway Proxy] ${error.code} hacia ${req.ruta ? req.ruta.destino : "?"}: ${err.code || err.message}`);
        if (res.headersSent) {
          res.end();
          return;
        }
        res.status(error.status).json(error.toRespuesta());
      }
    }
  });
}

/**
 * Middleware que despacha al proxy del destino de la ruta resuelta.
 * @param {{ bffPosUrl: string, bffPosTimeoutMs: number, bffAuditoriaUrl: string, bffAuditoriaTimeoutMs: number }} config
 */
function crearProxyRoutes(config) {
  const proxies = {
    bffPos: crearProxyDestino({ target: config.bffPosUrl, timeoutMs: config.bffPosTimeoutMs }),
    bffAuditoria: crearProxyDestino({ target: config.bffAuditoriaUrl, timeoutMs: config.bffAuditoriaTimeoutMs })
  };

  return function proxyHaciaBff(req, res, next) {
    return proxies[req.ruta.destino](req, res, next);
  };
}

module.exports = {
  crearProxyRoutes
};
