const { asegurarResultadoEvaluacionRepository } = require("./resultadoEvaluacionRepository.interface");

/**
 * Implementacion en memoria de ResultadoEvaluacionRepository (TTL + LRU).
 *
 * - Map conserva el orden de insercion: en un acierto la entrada se reinserta
 *   al final y, al superar la capacidad, se descarta la primera clave (LRU).
 * - Expiracion perezosa: una entrada vencida se elimina al leerla (sin timers).
 * - `ahora` es inyectable para probar el TTL de forma deterministica.
 * - Los modelos ResultadoEvaluacion son inmutables (Object.freeze), por lo que
 *   se pueden guardar y devolver sin copiar.
 * - Local a cada instancia del BFF (ver design.md, tradeoff de la cache).
 *
 * @param {{ ttlMs: number, maxEntradas: number, ahora?: () => number }} opciones
 * @returns {import("./resultadoEvaluacionRepository.interface").ResultadoEvaluacionRepository & { tamanio: () => number }}
 */
function crearMemoriaResultadoEvaluacionRepository({ ttlMs, maxEntradas, ahora = Date.now }) {
  const entradas = new Map();

  async function guardar(resultado) {
    entradas.delete(resultado.idEvaluacion);
    entradas.set(resultado.idEvaluacion, { resultado, expiraEn: ahora() + ttlMs });
    while (entradas.size > maxEntradas) {
      entradas.delete(entradas.keys().next().value);
    }
  }

  async function buscarPorId(idEvaluacion) {
    const entrada = entradas.get(idEvaluacion);
    if (!entrada) {
      return null;
    }
    if (ahora() >= entrada.expiraEn) {
      entradas.delete(idEvaluacion);
      return null;
    }
    // Renovar la posicion LRU.
    entradas.delete(idEvaluacion);
    entradas.set(idEvaluacion, entrada);
    return entrada.resultado;
  }

  const repositorio = asegurarResultadoEvaluacionRepository({ guardar, buscarPorId });
  repositorio.tamanio = () => entradas.size;
  return repositorio;
}

module.exports = {
  crearMemoriaResultadoEvaluacionRepository
};
