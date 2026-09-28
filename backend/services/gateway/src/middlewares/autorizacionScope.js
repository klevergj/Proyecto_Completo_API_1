const { scopesDelToken } = require("../utils/scopes");
const { scopeInsuficiente } = require("../utils/errorGateway");

/**
 * Autorizacion por scope (Req 2): el token debe incluir el scope exacto que la
 * Tabla_Rutas asigna a la ruta resuelta.
 */
function autorizacionScope(req, res, next) {
  const requerido = req.ruta.scope;
  if (!scopesDelToken(req.auth).has(requerido)) {
    res.setHeader("WWW-Authenticate", `Bearer error="insufficient_scope", scope="${requerido}"`);
    return next(scopeInsuficiente(requerido));
  }
  return next();
}

module.exports = {
  autorizacionScope
};
