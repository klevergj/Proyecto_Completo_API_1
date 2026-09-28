const crypto = require("crypto");

const MotorReglas = require("../domain/motorReglas");
const { asegurarHistorialClienteRepository } = require("../repositories/historialClienteRepository.interface");
const { asegurarDatosBuroRepository } = require("../repositories/datosBuroRepository.interface");
const { toDecisionCoreDto } = require("../dtos/decisionCoreDto");

/**
 * Caso de uso: Evaluar Solicitud de Credito.
 *
 * Orquesta la evaluacion crediticia con CONSULTA PEREZOSA (lazy) del buro
 * externo para proteger el KPI del 60% de evaluaciones sin buro (RF-06 crit. 5):
 *
 *   1. Obtiene el Historial_Interno (HistorialClienteRepository). Un 404 se
 *      traduce a `historial = null` (cliente nuevo); cualquier otro error se
 *      propaga (dato base imprescindible -> 5xx en la ruta).
 *   2. Ejecuta la FASE INTERNA del motor (reglas que NO requieren buro). Si una
 *      regla interna decide, se finaliza sin tocar el buro
 *      (`consultaBuroRealizada = false`).
 *   3. Si la fase interna no decide, consulta el buro (DatosBuroRepository, que
 *      nunca lanza por caida: devuelve fallback INDISPONIBLE) marcando
 *      `consultaBuroRealizada = true`, y ejecuta la FASE CON BURO (`continuar`),
 *      preservando el acumulado `reglasAplicadas` de la fase interna.
 *   4. Construye la DecisionCore con `idEvaluacion` (UUID), `reglasAplicadas` y
 *      `consultaBuroRealizada`.
 *   5. Publica el registro de auditoria de forma NO bloqueante (fire-and-forget)
 *      en todos los caminos resueltos, incluido el fallback del buro (RF-08).
 *
 * Depende SOLO de las interfaces de los repositorios (steering tech.md).
 *
 * @param {{ historialClienteRepository: Object, datosBuroRepository: Object,
 *           auditoriaPublisher: { publicarEvento: Function },
 *           motorReglas?: MotorReglas, generarId?: () => string, ahora?: () => Date }} deps
 */
function crearEvaluacionCreditoService({
  historialClienteRepository,
  datosBuroRepository,
  auditoriaPublisher,
  motorReglas = new MotorReglas(),
  generarId = () => crypto.randomUUID(),
  ahora = () => new Date()
}) {
  const historialRepo = asegurarHistorialClienteRepository(historialClienteRepository);
  const buroRepo = asegurarDatosBuroRepository(datosBuroRepository);

  async function evaluar(solicitud) {
    // 1. Historial interno: null = cliente nuevo; otros errores propagan.
    const historial = await historialRepo.buscarPorIdentificacion(solicitud.identificacion);

    // 2. Fase interna (sin buro).
    const estadoInterno = motorReglas.ejecutarInternas(historial, solicitud);

    let decision;
    let consultaBuroRealizada = false;
    let buro = null;

    if (estadoInterno.decidido) {
      // Una regla interna emitio veredicto: no se consulta el buro.
      decision = estadoInterno.resultado;
    } else {
      // 3. Consulta condicional del buro (nunca lanza por caida).
      buro = await buroRepo.obtenerPorIdentificacion(solicitud.identificacion);
      consultaBuroRealizada = true;
      decision = motorReglas.continuar(historial, buro, solicitud, estadoInterno);
    }

    // 4. DecisionCore (contrato spec4).
    const decisionCore = toDecisionCoreDto({
      idEvaluacion: generarId(),
      decision,
      fecha: ahora().toISOString(),
      consultaBuroRealizada
    });

    // 5. Auditoria fire-and-forget: sincrono, no bloqueante y no lanza.
    auditoriaPublisher.publicarEvento({
      idEvaluacion: decisionCore.idEvaluacion,
      identificacion: solicitud.identificacion,
      montoSolicitado: solicitud.montoSolicitado,
      plazoMeses: solicitud.plazoMeses,
      decision: decisionCore.decision,
      motivo: decisionCore.motivo,
      reglasAplicadas: decisionCore.reglasAplicadas,
      consultaBuroRealizada,
      fecha: decisionCore.fecha,
      tiendaId: solicitud.tiendaId,
      scoreBuro: buro ? buro.score : null
    });

    return decisionCore;
  }

  async function obtenerPorId(id) {
    // Placeholder para consulta de evaluacion por ID (pendiente, spec4).
    return {
      idEvaluacion: id,
      status: "COMPLETADA"
    };
  }

  return { evaluar, obtenerPorId };
}

module.exports = {
  crearEvaluacionCreditoService
};
