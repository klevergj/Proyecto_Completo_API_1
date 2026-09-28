const axios = require("axios");
const CircuitBreaker = require("opossum");
const DatosBuro = require("../models/datosBuro");
const { asegurarDatosBuroRepository } = require("./datosBuroRepository.interface");

// Rango valido de score segun contrato buro-simulado (ScoreResponse: 300-850).
const SCORE_MIN = 300;
const SCORE_MAX = 850;

/**
 * Normaliza un score crudo del contrato ScoreResponse a number|null.
 * Solo se acepta un numero dentro del rango valido 300-850; cualquier otro
 * valor (null, no numerico, fuera de rango) se traduce a null para que el
 * dominio no tome decisiones con datos no confiables.
 */
function normalizarScore(scoreCrudo) {
  if (typeof scoreCrudo !== "number" || Number.isNaN(scoreCrudo)) {
    return null;
  }
  if (scoreCrudo < SCORE_MIN || scoreCrudo > SCORE_MAX) {
    return null;
  }
  return scoreCrudo;
}

/**
 * Mapea la respuesta real del buro (ScoreResponse, que NO incluye estadoBuro)
 * al modelo DatosBuro. Se sintetiza estadoBuro: "DISPONIBLE" en el camino exitoso.
 */
function normalizarRespuesta(data) {
  const fuente = data || {};
  return new DatosBuro({
    score: normalizarScore(fuente.score),
    moraExterna: fuente.moraExterna === true,
    deudaExternaTotal:
      typeof fuente.deudaExternaTotal === "number" && !Number.isNaN(fuente.deudaExternaTotal)
        ? fuente.deudaExternaTotal
        : 0,
    estadoBuro: "DISPONIBLE"
  });
}

/**
 * Determina si un error de axios corresponde a una respuesta HTTP 4xx
 * (error del cliente: entrada invalida), segun el contrato buro-simulado el
 * caso 400 -> INVALID_IDENTIFICACION. Un 4xx NO es una caida del buro.
 */
function esErrorCliente4xx(error) {
  const status = error && error.response && error.response.status;
  return typeof status === "number" && status >= 400 && status <= 499;
}

/**
 * Construye un Error tipado de cliente a partir de una respuesta 4xx del buro.
 * Expone `status` (4xx del upstream) y `code` (usa error.error.code del
 * contrato ErrorRespuesta cuando existe, ej. "INVALID_IDENTIFICACION"; si no,
 * "BURO_BAD_REQUEST"). Se marca con esClienteBuro para que el breaker lo
 * filtre y obtenerPorIdentificacion lo re-lance sin caer al fallback INDISPONIBLE.
 */
function construirErrorCliente(error, identificacion) {
  const status = (error && error.response && error.response.status) || 400;
  const cuerpo = (error && error.response && error.response.data) || {};
  const codeUpstream = cuerpo && cuerpo.error && cuerpo.error.code;
  const messageUpstream = cuerpo && cuerpo.error && cuerpo.error.message;

  const errClient = new Error(
    messageUpstream || `Solicitud invalida al buro externo para ID ${identificacion} (HTTP ${status})`
  );
  errClient.status = status;
  errClient.code = codeUpstream || "BURO_BAD_REQUEST";
  errClient.esClienteBuro = true;
  return errClient;
}

/**
 * Implementacion HTTP de DatosBuroRepository contra buro-simulado, protegida
 * por un Circuit Breaker (opossum) con fallback a DatosBuro.indisponible()
 * (steering tech.md: Circuit Breaker obligatorio hacia el buro).
 *
 * @param {{ baseURL?: string, timeoutMs?: number, httpClient?: Object,
 *           breakerOptions?: { timeout: number, errorThresholdPercentage: number, resetTimeout: number } }} opciones
 * @returns {import("./datosBuroRepository.interface").DatosBuroRepository & { breaker: CircuitBreaker }}
 */
function crearHttpDatosBuroRepository({
  baseURL,
  timeoutMs = 3000,
  httpClient,
  breakerOptions = { timeout: 3000, errorThresholdPercentage: 50, resetTimeout: 10000 }
} = {}) {
  const cliente = httpClient || axios.create({ baseURL, timeout: timeoutMs });

  async function llamarBuro(identificacion) {
    try {
      const response = await cliente.get(`/score/${identificacion}`);
      return normalizarRespuesta(response.data);
    } catch (error) {
      // Un 4xx es un error del cliente (entrada invalida), NO una caida.
      if (esErrorCliente4xx(error)) {
        throw construirErrorCliente(error, identificacion);
      }
      // 503, 504, timeout, red: el breaker lo cuenta como fallo.
      throw error;
    }
  }

  const breaker = new CircuitBreaker(llamarBuro, {
    ...breakerOptions,
    // errorFilter => true: opossum NO cuenta el error como fallo, NO invoca el
    // fallback y re-lanza el error al llamador. Asi los 4xx se propagan.
    errorFilter: (error) => Boolean(error && error.esClienteBuro)
  });

  breaker.fallback((identificacion) => {
    console.warn(`[CircuitBreaker] Activado fallback para buro externo con ID: ${identificacion}`);
    return DatosBuro.indisponible();
  });

  /**
   * Nunca propaga una excepcion por caida del buro (RF-07 crit. 1-2); solo
   * re-lanza los errores de cliente 4xx.
   */
  async function obtenerPorIdentificacion(identificacion) {
    try {
      return await breaker.fire(identificacion);
    } catch (error) {
      if (error && (error.esClienteBuro || (typeof error.status === "number" && error.status >= 400 && error.status <= 499))) {
        throw error;
      }
      console.warn(`[DatosBuroRepository] Buro indisponible para ID ${identificacion}: ${error.message}`);
      return DatosBuro.indisponible();
    }
  }

  const repositorio = asegurarDatosBuroRepository({ obtenerPorIdentificacion });
  repositorio.breaker = breaker;
  return repositorio;
}

module.exports = {
  crearHttpDatosBuroRepository,
  normalizarRespuesta
};
