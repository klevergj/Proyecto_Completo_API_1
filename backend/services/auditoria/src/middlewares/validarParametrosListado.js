const { validarParametrosListado: validar } = require("../dtos/listadoRegistrosDto");
const { parametroInvalido } = require("../utils/errorAuditoria");

/**
 * Crea el middleware que valida filtros y paginacion de GET /registros sin
 * consultar el almacen (Req 2.7, 4.4) y deja { filtros, page, size } en req.listado.
 *
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
