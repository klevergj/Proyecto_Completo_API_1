const { validarRegistroAuditoria: validar } = require("../dtos/registroAuditoriaDto");
const { registroInvalido } = require("../utils/errorAuditoria");

/**
 * Middleware: valida el RegistroAuditoria (lista blanca) antes del
 * controlador y deja el valor normalizado en req.registro (Req 1.3-1.5).
 */
function validarRegistroAuditoria(req, res, next) {
  const resultado = validar(req.body);
  if (!resultado.ok) {
    return next(registroInvalido(resultado.errores.join(". ")));
  }
  req.registro = resultado.valor;
  return next();
}

module.exports = {
  validarRegistroAuditoria
};
