/**
 * Lectura de los claims del Token_Acceso (Keycloak).
 */

/**
 * Scopes del token (Req 2.4): claim `scope` (cadena separada por espacios) y/o
 * `scp` (arreglo). Coincidencia exacta, sin prefijos ni subcadenas.
 * @param {Object} auth payload verificado del JWT
 * @returns {Set<string>}
 */
function scopesDelToken(auth = {}) {
  const scopes = new Set();
  if (typeof auth.scope === "string") {
    auth.scope.split(/\s+/).filter(Boolean).forEach((s) => scopes.add(s));
  }
  if (Array.isArray(auth.scp)) {
    auth.scp.filter((s) => typeof s === "string").forEach((s) => scopes.add(s));
  }
  return scopes;
}

/**
 * Identificador del Cliente_API (Req 3.1): `azp` (Keycloak) o `client_id`.
 * @param {Object} auth
 * @returns {string}
 */
function identificadorCliente(auth = {}) {
  return auth.azp || auth.client_id || "desconocido";
}

module.exports = {
  scopesDelToken,
  identificadorCliente
};
