const axios = require("axios");
const { toRegistroAuditoriaDto } = require("../dtos/registroAuditoriaDto");

/**
 * Publicador de auditoria (llamada saliente que no es lectura de datos, por
 * eso vive en clients/). Publicacion no bloqueante (fire-and-forget): el envio
 * tiene timeout y cualquier fallo solo se registra en log; NUNCA altera ni
 * bloquea la DecisionCore devuelta (RF-08 crit. 3).
 *
 * @param {{ baseURL?: string, timeoutMs?: number, httpClient?: Object }} opciones
 * @returns {{ publicarEvento: (datos: Object) => void }}
 */
function crearAuditoriaPublisher({ baseURL, timeoutMs = 3000, httpClient } = {}) {
  const cliente = httpClient || axios.create({ baseURL, timeout: timeoutMs });

  function publicarEvento(datos) {
    const registro = toRegistroAuditoriaDto(datos);

    // Fire-and-forget: no se espera (await) la promesa; el fallo solo se loguea.
    Promise.resolve()
      .then(() => cliente.post("/registros", registro))
      .catch((err) => {
        console.warn(
          "[EvaluacionCore] Error publicando auditoria (no bloqueante):",
          err && err.message ? err.message : err
        );
      });
  }

  return { publicarEvento };
}

module.exports = {
  crearAuditoriaPublisher
};
