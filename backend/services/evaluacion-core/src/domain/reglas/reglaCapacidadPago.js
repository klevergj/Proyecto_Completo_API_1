/**
 * Regla de Evaluacion (Strategy, interna): Capacidad de Pago / Monto bajo.
 *
 * Cubre dos responsabilidades de negocio que viven en la misma regla interna
 * (no requiere buro):
 *   - Aprobacion automatica por monto bajo con historial limpio (RF-05).
 *   - Evaluacion de la relacion cuota/ingreso y datos insuficientes (RF-03).
 *
 * Los umbrales se leen EXCLUSIVAMENTE desde reglasConfig, nunca de process.env.
 * Cuando un umbral esta invalido (null en la config) la regla se auto-inhibe
 * en la rama afectada, devolviendo null para que el motor continue la cadena.
 *
 * Resultado de una regla:
 *   null                                    -> continuar la cadena
 *   { decision, motivo, nombreRegla }       -> veredicto definitivo
 *
 * @param {Object|null} cliente - Historial interno del cliente (null = cliente nuevo)
 * @param {Object} solicitud - Solicitud con montoSolicitado y plazoMeses
 * @returns {Object|null} Resultado si la regla decide, o null para continuar
 */

const reglasConfig = require("../../config/reglasConfig");

const NOMBRE = "REGLA_CAPACIDAD_PAGO";

/**
 * Verifica que un valor sea un numero finito estrictamente mayor que cero.
 * @param {*} valor
 * @returns {boolean}
 */
function esNumeroPositivo(valor) {
  return typeof valor === "number" && Number.isFinite(valor) && valor > 0;
}

function evaluar(cliente, solicitud) {
  const {
    porcentajeCuotaIngreso,
    modoCuotaIngreso,
    topeMontoAprobacionAutomatica
  } = reglasConfig;

  const solicitudSegura = solicitud || {};
  const montoSolicitado = solicitudSegura.montoSolicitado;
  const plazoMeses = solicitudSegura.plazoMeses;

  // Historial ausente o mora indeterminada: esta regla no aplica; que el motor
  // continue hacia las reglas dependientes del buro (RF-05 crit. 4).
  if (!cliente || typeof cliente.tieneMoraVigente !== "boolean") {
    return null;
  }

  // Solo se opera sobre historial presente y sin mora vigente. Si registra mora
  // vigente, la Regla_Mora_Vigente previa ya deberia haber decidido; aqui se
  // continua la cadena por seguridad.
  if (cliente.tieneMoraVigente === true) {
    return null;
  }

  // --- Aprobacion automatica por monto bajo con historial limpio (RF-05) ---
  // Requiere tope de config valido (> 0) e importe conocido dentro del tope.
  // Si el tope es invalido, no se aprueba por esta via (RF-05 crit. 5) y se
  // continua evaluando la capacidad de pago mas abajo.
  if (
    esNumeroPositivo(topeMontoAprobacionAutomatica) &&
    esNumeroPositivo(montoSolicitado) &&
    montoSolicitado <= topeMontoAprobacionAutomatica
  ) {
    return {
      decision: "APROBADO",
      motivo:
        `Monto solicitado (${montoSolicitado}) dentro del tope de aprobacion ` +
        `automatica (${topeMontoAprobacionAutomatica}) e historial interno limpio.`,
      nombreRegla: NOMBRE
    };
  }

  // --- Datos insuficientes: ingreso declarado (RF-03 crit. 4) ---
  if (!esNumeroPositivo(cliente.ingresosDeclarados)) {
    return {
      decision: "REVISION_MANUAL",
      motivo:
        "Ingreso declarado ausente o invalido en el historial interno; " +
        "se deriva a revision manual para verificar capacidad de pago.",
      nombreRegla: NOMBRE
    };
  }

  // --- Datos insuficientes: plazo (RF-03 crit. 5) — sin calcular la cuota ---
  if (!esNumeroPositivo(plazoMeses)) {
    return {
      decision: "REVISION_MANUAL",
      motivo:
        "Plazo en meses invalido en la solicitud; se deriva a revision manual " +
        "sin calcular la cuota mensual.",
      nombreRegla: NOMBRE
    };
  }

  // Sin monto valido no es posible calcular la cuota; se deriva a revision.
  if (!esNumeroPositivo(montoSolicitado)) {
    return {
      decision: "REVISION_MANUAL",
      motivo:
        "Monto solicitado invalido en la solicitud; se deriva a revision manual " +
        "sin calcular la cuota mensual.",
      nombreRegla: NOMBRE
    };
  }

  // Sin porcentaje valido en config, la regla se auto-inhibe en esta rama y el
  // motor continua la cadena (RF-03 crit. 6).
  if (!esNumeroPositivo(porcentajeCuotaIngreso)) {
    return null;
  }

  // --- Relacion cuota/ingreso (RF-03 crit. 1-3) ---
  const cuotaMensual = montoSolicitado / plazoMeses;
  const relacionCuotaIngreso = cuotaMensual / cliente.ingresosDeclarados;

  if (relacionCuotaIngreso > porcentajeCuotaIngreso) {
    // El modo determina el veredicto; si el modo es invalido (null), se
    // continua la cadena en lugar de emitir una decision con parametro dudoso.
    if (modoCuotaIngreso !== "RECHAZADO" && modoCuotaIngreso !== "REVISION_MANUAL") {
      return null;
    }

    const porcentajeRelacion = (relacionCuotaIngreso * 100).toFixed(1);
    const porcentajeLimite = (porcentajeCuotaIngreso * 100).toFixed(1);

    return {
      decision: modoCuotaIngreso,
      motivo:
        `Relacion cuota/ingreso (${porcentajeRelacion}%) supera el maximo ` +
        `tolerado (${porcentajeLimite}%): cuota mensual estimada ${cuotaMensual.toFixed(2)} ` +
        `sobre ingreso declarado ${cliente.ingresosDeclarados}.`,
      nombreRegla: NOMBRE
    };
  }

  // Relacion cuota/ingreso dentro del limite: continuar la cadena (RF-03 crit. 3).
  return null;
}

module.exports = {
  nombre: NOMBRE,
  requiereBuro: false,
  evaluar
};
