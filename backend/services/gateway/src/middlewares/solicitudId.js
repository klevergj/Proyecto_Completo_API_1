const crypto = require("crypto");

const ID_VALIDO = /^[A-Za-z0-9._-]{1,128}$/;

/**
 * X-Request-Id (Req 4.7): conserva el recibido si es seguro; si no, genera un
 * UUID. Se devuelve al cliente y se propaga a los BFFs.
 */
function solicitudId(req, res, next) {
  const recibido = req.get("X-Request-Id");
  req.idSolicitud = recibido && ID_VALIDO.test(recibido) ? recibido : crypto.randomUUID();
  res.setHeader("X-Request-Id", req.idSolicitud);
  next();
}

module.exports = {
  solicitudId
};
