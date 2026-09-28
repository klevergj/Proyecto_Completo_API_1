const { validarParametrosListado: validar } = require("../dtos/parametrosListadoDto");
const { parametroInvalido } = require("../utils/errorBffAuditoria");

/**
 * Crea el middleware que valida el listado antes de salir a red
 * (Req 1.3, 2.2) y deja los parametros normalizados en req.listado.
 * @param {{ paginaTamanoDefecto: number, paginaTamanoMaximo: number }} paginacion
 */
function crearValidarParametrosListado(paginacion) {
  return function validarParametrosListado(req, res, next) {
    const resultado = validar(req.query, paginacion);
    if (!resultado.ok) {
      return next(parametroInvalido(resultado.errores.join(". ")));
    }
    req.listado = resultado.valor;
    return next();
  };
}

module.exports = {
  crearValidarParametrosListado
};
