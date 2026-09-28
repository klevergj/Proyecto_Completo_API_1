const { errorEvaluacion } = require("../utils/errorBff");

const DECISIONES = Object.freeze(["APROBADO", "RECHAZADO", "REVISION_MANUAL"]);

/**
 * Modelo de dominio del BFF: el resultado de una evaluacion ya emitida por el
 * core, reducido a lo que el BFF necesita conservar (id + decision).
 *
 * Es lo que guarda y devuelve ResultadoEvaluacionRepository. No conoce el
 * formato de caja (aprobado / mensajeParaCliente): eso lo arma el DTO.
 */
class ResultadoEvaluacion {
  /**
   * @param {{ idEvaluacion: string, decision: "APROBADO"|"RECHAZADO"|"REVISION_MANUAL" }} datos
   */
  constructor({ idEvaluacion, decision }) {
    this.idEvaluacion = idEvaluacion;
    this.decision = decision;
    Object.freeze(this);
  }

  /**
   * @param {*} decisionCore
   * @returns {boolean} true si tiene idEvaluacion no vacio y una decision conocida
   */
  static esDecisionCoreValida(decisionCore) {
    return (
      decisionCore !== null &&
      typeof decisionCore === "object" &&
      typeof decisionCore.idEvaluacion === "string" &&
      decisionCore.idEvaluacion.trim().length > 0 &&
      DECISIONES.includes(decisionCore.decision)
    );
  }

  /**
   * Construye el modelo desde la DecisionCore (Spec 4). Sin valores por
   * defecto: una DecisionCore invalida lanza ErrorBff 502 ERROR_EVALUACION en
   * lugar de inventar un resultado (RF-02 crit. 5).
   * @param {*} decisionCore
   * @returns {ResultadoEvaluacion}
   */
  static desdeDecisionCore(decisionCore) {
    if (!ResultadoEvaluacion.esDecisionCoreValida(decisionCore)) {
      throw errorEvaluacion();
    }
    return new ResultadoEvaluacion({ idEvaluacion: decisionCore.idEvaluacion, decision: decisionCore.decision });
  }
}

ResultadoEvaluacion.DECISIONES = DECISIONES;

module.exports = ResultadoEvaluacion;
