import { v4 as uuidv4 } from 'uuid';
import { CircuitBreaker } from './circuitBreaker.js';

const buroCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeout: 10000,
  requestTimeout: 2000
});

export const getCircuitBreakerState = () => buroCircuitBreaker.getState();

/**
 * STRATEGY PATTERN: Estrategias de Decisión por Score de Buró
 */
class MoraBuroStrategy {
  applies(scoreData) {
    return scoreData && scoreData.reportadoEnMora === true;
  }
  execute() {
    return {
      decision: 'RECHAZADO',
      motivo: 'Cliente reportado en mora en buró crediticio externo',
      reglaNombre: 'REGLA_BURO_MORA_EXTERNA'
    };
  }
}

class HighScoreStrategy {
  applies(scoreData) {
    return scoreData && scoreData.score >= 700;
  }
  execute(scoreData) {
    return {
      decision: 'APROBADO',
      motivo: `Cumple reglas de score (${scoreData.score} pts) y capacidad de pago`,
      reglaNombre: 'REGLA_BURO_SCORE_OPTIMO'
    };
  }
}

class BorderlineScoreStrategy {
  applies(scoreData) {
    return scoreData && scoreData.score >= 600 && scoreData.score < 700;
  }
  execute(scoreData) {
    return {
      decision: 'REVISION_MANUAL',
      motivo: `Score limítrofe (${scoreData.score} pts), requiere validación de un analista`,
      reglaNombre: 'REGLA_BURO_SCORE_LIMITROFE'
    };
  }
}

class LowScoreStrategy {
  applies(scoreData) {
    return scoreData && scoreData.score < 600;
  }
  execute(scoreData) {
    return {
      decision: 'RECHAZADO',
      motivo: `Score crediticio insuficiente en buró externo (${scoreData.score} pts)`,
      reglaNombre: 'REGLA_BURO_SCORE_BAJO'
    };
  }
}

const buroStrategies = [
  new MoraBuroStrategy(),
  new HighScoreStrategy(),
  new BorderlineScoreStrategy(),
  new LowScoreStrategy()
];

/**
 * CHAIN OF RESPONSIBILITY PATTERN: Handlers de la Cadena de Evaluación
 */

// Step 1: Consultar Repositorio Interno (:8092)
async function handleInternalHistoryStep(context, next) {
  const repoUrl = process.env.REPO_SERVICE_URL || 'http://localhost:8092';
  context.reglasAplicadas.push('REGLA_HISTORIAL_INTERNO');

  try {
    const res = await fetch(`${repoUrl}/v1/clientes/${context.solicitud.identificacion}/historial`);
    if (res.ok) {
      const historial = await res.json();
      context.historialInterno = historial;

      if (historial.tieneMoraVigente) {
        context.resultadoFinal = {
          idEvaluacion: context.idEvaluacion,
          decision: 'RECHAZADO',
          motivo: 'Mora vigente en historial interno',
          consultaBuroRealizada: false,
          fecha: context.fecha,
          tiendaId: context.solicitud.tiendaId,
          scoreBuro: null,
          reglasAplicadas: [...context.reglasAplicadas, 'REGLA_RECHAZO_MORA_INTERNA']
        };
        // Detener cadena si hay mora en repositorio interno
        return;
      }
    } else if (res.status === 404) {
      console.log(`[CoreEngine] Cliente ${context.solicitud.identificacion} no tiene historial previo (cliente nuevo)`);
      context.historialInterno = { clienteNuevo: true, tieneMoraVigente: false };
    }
  } catch (err) {
    console.warn(`[CoreEngine] No se pudo consultar repositorio interno (${err.message}). Se asume cliente nuevo.`);
    context.historialInterno = { clienteNuevo: true, tieneMoraVigente: false };
  }

  // Pasar al siguiente eslabón de la cadena
  return next();
}

// Step 2: Consultar Adapter Buró Externo (:8091) con Circuit Breaker
async function handleExternalBuroStep(context, next) {
  const buroUrl = process.env.BURO_SERVICE_URL || 'http://localhost:8091';
  context.reglasAplicadas.push('REGLA_BURO_EXTERNO');

  try {
    const scoreData = await buroCircuitBreaker.execute(async () => {
      const response = await fetch(`${buroUrl}/v1/score/${context.solicitud.identificacion}`);
      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status} from Buró Simulado`);
      }
      return await response.json();
    });

    context.scoreBuro = scoreData.score;
    context.consultaBuroRealizada = true;

    // Ejecutar Estrategia según el score recibido
    const matchedStrategy = buroStrategies.find((s) => s.applies(scoreData));
    const outcome = matchedStrategy ? matchedStrategy.execute(scoreData) : {
      decision: 'REVISION_MANUAL',
      motivo: 'Evaluación de score no determinista',
      reglaNombre: 'REGLA_SCORE_INDEFINIDO'
    };

    context.resultadoFinal = {
      idEvaluacion: context.idEvaluacion,
      decision: outcome.decision,
      motivo: outcome.motivo,
      consultaBuroRealizada: true,
      fecha: context.fecha,
      tiendaId: context.solicitud.tiendaId,
      scoreBuro: scoreData.score,
      reglasAplicadas: [...context.reglasAplicadas, outcome.reglaNombre]
    };
  } catch (error) {
    console.error(`⚠️ [CoreEngine] Fallo al consultar buró externo: ${error.message}. Aplicando fallback de Circuit Breaker.`);
    
    // Fallback de resiliencia por Circuit Breaker o falla de servicio
    context.resultadoFinal = {
      idEvaluacion: context.idEvaluacion,
      decision: 'REVISION_MANUAL',
      motivo: 'Buró crediticio no disponible temporalmente (Circuit Breaker activo). Derivado a revisión manual.',
      consultaBuroRealizada: false,
      fecha: context.fecha,
      tiendaId: context.solicitud.tiendaId,
      scoreBuro: null,
      reglasAplicadas: [...context.reglasAplicadas, 'REGLA_BURO_FALLBACK_CIRCUIT_BREAKER']
    };
  }

  return next();
}

// Step 3: Notificar/Guardar en Servicio de Auditoría (:8095)
async function handleAuditStep(context) {
  const auditUrl = process.env.AUDIT_SERVICE_URL || 'http://localhost:8095';

  try {
    await fetch(`${auditUrl}/v1/registros`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(context.resultadoFinal)
    });
    console.log(`📡 [CoreEngine] Registro de auditoría guardado exitosamente para ID: ${context.idEvaluacion}`);
  } catch (err) {
    console.error(`⚠️ [CoreEngine] No se pudo enviar registro al Servicio de Auditoría: ${err.message}`);
  }
}

/**
 * Ejecutor principal del Motor Core de Evaluación
 */
export async function ejecutarEvaluacionCore(solicitud) {
  const context = {
    idEvaluacion: uuidv4(),
    fecha: new Date().toISOString(),
    solicitud,
    reglasAplicadas: [],
    resultadoFinal: null
  };

  // Armado de la cadena de responsabilidad
  const chain = [
    handleInternalHistoryStep,
    handleExternalBuroStep
  ];

  let index = 0;
  async function dispatch() {
    if (index < chain.length && !context.resultadoFinal) {
      const handler = chain[index++];
      await handler(context, dispatch);
    }
  }

  await dispatch();

  // Siempre enviar a Auditoría tras dictaminar resultado
  if (context.resultadoFinal) {
    await handleAuditStep(context);
  }

  return context.resultadoFinal;
}
