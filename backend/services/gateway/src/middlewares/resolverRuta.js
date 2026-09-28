const { resolverRuta: buscarEnTabla } = require("../routes/tablaRutas");
const { rutaNoEncontrada } = require("../utils/errorGateway");

/**
 * Resuelve la ruta en la Tabla_Rutas ANTES de autenticar (Req 4.4, 5.2): una
 * ruta inexistente o sin /v1 responde 404 sin exigir token ni verificar firmas.
 */
function resolverRuta(req, res, next) {
  const ruta = buscarEnTabla(req.method, req.path);
  if (!ruta) {
    return next(rutaNoEncontrada());
  }
  req.ruta = ruta;
  return next();
}

module.exports = {
  resolverRuta
};
