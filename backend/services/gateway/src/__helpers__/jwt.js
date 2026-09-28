/**
 * Fixtures OAuth2 para pruebas: par RSA, servidor JWKS local (para ejercitar
 * jwks-rsa real) y firma de tokens con jsonwebtoken.
 */
const crypto = require("crypto");
const http = require("http");
const jwt = require("jsonwebtoken");

const ISSUER = "http://keycloak.test/realms/resuelve";
const AUDIENCE = "resuelve-api";
const KID = "clave-prueba-1";

const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const otraClave = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });

/**
 * Levanta un servidor JWKS en un puerto libre.
 * @returns {Promise<{ jwksUri: string, peticiones: () => number, cerrar: () => Promise<void> }>}
 */
function levantarJwks() {
  let peticiones = 0;
  const jwks = { keys: [{ ...publicKey.export({ format: "jwk" }), kid: KID, alg: "RS256", use: "sig" }] };
  const servidor = http.createServer((req, res) => {
    peticiones += 1;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(jwks));
  });
  return new Promise((resolve) => {
    servidor.listen(0, () => {
      resolve({
        jwksUri: `http://localhost:${servidor.address().port}/certs`,
        peticiones: () => peticiones,
        cerrar: () => new Promise((r) => servidor.close(() => r()))
      });
    });
  });
}

/**
 * Firma un token de acceso como lo haria Keycloak (client_credentials).
 * @param {Object} claims claims adicionales (scope, azp, ...)
 * @param {{ clave?: crypto.KeyObject, kid?: string, algoritmo?: string, expiraEn?: string|number,
 *           issuer?: string, audience?: string }} [opciones]
 */
function firmarToken(claims = {}, opciones = {}) {
  const {
    clave = privateKey,
    kid = KID,
    algoritmo = "RS256",
    expiraEn = "5m",
    issuer = ISSUER,
    audience = AUDIENCE
  } = opciones;
  return jwt.sign({ azp: "tienda-demo", ...claims }, clave, {
    algorithm: algoritmo,
    keyid: kid,
    expiresIn: expiraEn,
    issuer,
    audience
  });
}

module.exports = {
  ISSUER,
  AUDIENCE,
  KID,
  privateKey,
  otraClave,
  levantarJwks,
  firmarToken
};
