/**
 * Puerto (interfaz) del repositorio de resultados de evaluacion ya emitidos,
 * usado para las reconsultas de estado (RF-04, Cache-Aside).
 *
 * El servicio depende SOLO de esta interfaz. La implementacion actual es en
 * memoria (memoriaResultadoEvaluacionRepository); si el BFF escala a varias
 * replicas puede reemplazarse por una sobre Redis sin tocar el servicio.
 *
 * @typedef {Object} ResultadoEvaluacionRepository
 * @property {(resultado: import("../models/resultadoEvaluacion")) => Promise<void>} guardar
 *   Almacena (o reemplaza) el resultado asociado a su idEvaluacion.
 * @property {(idEvaluacion: string) => Promise<import("../models/resultadoEvaluacion")|null>} buscarPorId
 *   Devuelve el resultado vigente o null si no existe o expiro.
 */

const METODOS_RESULTADO_EVALUACION_REPOSITORY = Object.freeze(["guardar", "buscarPorId"]);

/**
 * Verifica en tiempo de ejecucion que `implementacion` cumpla la interfaz
 * (JavaScript no tiene `implements`). Se invoca al inyectar el repositorio.
 * @param {*} implementacion
 * @returns {ResultadoEvaluacionRepository}
 * @throws {TypeError} si falta algun metodo
 */
function asegurarResultadoEvaluacionRepository(implementacion) {
  for (const metodo of METODOS_RESULTADO_EVALUACION_REPOSITORY) {
    if (!implementacion || typeof implementacion[metodo] !== "function") {
      throw new TypeError(`ResultadoEvaluacionRepository invalido: falta el metodo "${metodo}"`);
    }
  }
  return implementacion;
}

module.exports = {
  METODOS_RESULTADO_EVALUACION_REPOSITORY,
  asegurarResultadoEvaluacionRepository
};
