const reglaMoraVigente = require("./reglas/reglaMoraVigente");
const reglaCapacidadPago = require("./reglas/reglaCapacidadPago");
const reglaScoreBuro = require("./reglas/reglaScoreBuro");
const reglaClienteNuevo = require("./reglas/reglaClienteNuevo");

/**
 * Identificador de la decision por defecto (aprobacion) que se aplica cuando
 * ninguna regla de la cadena emite un veredicto definitivo (RF-06 crit. 4).
 */
const DEFAULT_APROBADO = "DEFAULT_APROBADO";

/**
 * Orden documentado de la cadena (RF-06 crit. 5, diseno seccion "Orquestacion"):
 *   REGLA_MORA_VIGENTE (interna) -> REGLA_CAPACIDAD_PAGO (interna)
 *   -> REGLA_SCORE_BURO (buro) -> REGLA_CLIENTE_NUEVO (buro)
 * Las reglas internas (requiereBuro === false) van primero para proteger el
 * KPI del 60% sin buro: la fase interna puede decidir sin salir a red.
 */
const CADENA_POR_DEFECTO = [
  reglaMoraVigente,
  reglaCapacidadPago,
  reglaScoreBuro,
  reglaClienteNuevo
];

/**
 * Motor de Reglas — Chain of Responsibility con ejecucion por fases.
 *
 * Recorre las reglas en orden, acumulando en `reglasAplicadas` el `nombre` de
 * cada regla evaluada (ordenado, sin duplicados) hasta la regla que decide,
 * inclusive. Si ninguna decide, aplica el fallback `DEFAULT_APROBADO` e incluye
 * todos los nombres mas ese identificador (RF-06 crit. 2-4).
 *
 * Cada regla (Strategy) expone metadatos estables `{ nombre, requiereBuro, evaluar }`.
 * El motor no se acopla a nombres concretos para decidir el punto de corte de la
 * consulta perezosa: usa el flag `requiereBuro`. Las firmas concretas de `evaluar`
 * difieren entre reglas internas y de buro, por lo que el motor despacha a cada
 * una con los argumentos que espera a partir de un contexto comun
 * `(historial, buro, solicitud)`.
 *
 * Ejecucion por fases (soporte a la consulta perezosa del caso de uso):
 *   - `ejecutarInternas(historial, solicitud)` corre solo las reglas con
 *     `requiereBuro === false`. Si alguna decide, devuelve la DecisionCore
 *     parcial (`decidido: true`). Si ninguna decide, devuelve un estado
 *     `decidido: false` con el acumulado `reglasAplicadas` de la fase interna,
 *     para que el llamador consulte el buro y continue.
 *   - `continuar(historial, buro, solicitud, estadoPrevio)` retoma la cadena
 *     con las reglas restantes (las que requieren buro), preservando el
 *     acumulado `reglasAplicadas` recibido del estado previo. Aplica el fallback
 *     si ninguna decide.
 */
class MotorReglas {
  /**
   * @param {Array<{nombre: string, requiereBuro: boolean, evaluar: Function}>} reglas
   *        Cadena de reglas en orden de ejecucion. Por defecto la cadena documentada.
   */
  constructor(reglas = CADENA_POR_DEFECTO) {
    this.reglas = reglas;
  }

  /**
   * Anade un nombre al acumulado preservando orden y evitando duplicados.
   * @param {string[]} acumulado
   * @param {string} nombre
   * @returns {string[]} nuevo acumulado (no muta el original)
   */
  static _acumular(acumulado, nombre) {
    if (acumulado.includes(nombre)) {
      return acumulado;
    }
    return [...acumulado, nombre];
  }

  /**
   * Invoca `evaluar` de una regla con los argumentos que espera segun su tipo.
   * Reglas internas (requiereBuro === false): `evaluar(historial, solicitud)`.
   * Reglas de buro (requiereBuro === true): `reglaScoreBuro` espera
   * `(historial, buro, solicitud)` y `reglaClienteNuevo` espera `(historial, buro)`.
   * Pasar argumentos extra es inocuo, de modo que se despacha con la firma mas
   * amplia `(historial, buro, solicitud)` para las reglas de buro.
   * @param {Object} regla
   * @param {Object|null} historial
   * @param {Object|null} buro
   * @param {Object} solicitud
   * @returns {Object|null} ResultadoRegla o null
   */
  static _invocar(regla, historial, buro, solicitud) {
    if (regla.requiereBuro) {
      return regla.evaluar(historial, buro, solicitud);
    }
    return regla.evaluar(historial, solicitud);
  }

  /**
   * Recorre un subconjunto de reglas acumulando nombres y deteniendose en la
   * primera que decide.
   * @param {Array} reglas subconjunto de la cadena a recorrer
   * @param {Object|null} historial
   * @param {Object|null} buro
   * @param {Object} solicitud
   * @param {string[]} acumuladoPrevio nombres ya aplicados en fases anteriores
   * @returns {{decidido: boolean, resultado: Object|null, reglasAplicadas: string[]}}
   */
  static _recorrer(reglas, historial, buro, solicitud, acumuladoPrevio) {
    let reglasAplicadas = [...acumuladoPrevio];

    for (const regla of reglas) {
      reglasAplicadas = MotorReglas._acumular(reglasAplicadas, regla.nombre);
      const resultado = MotorReglas._invocar(regla, historial, buro, solicitud);
      if (resultado !== null && resultado !== undefined) {
        return {
          decidido: true,
          resultado: {
            decision: resultado.decision,
            motivo: resultado.motivo,
            reglasAplicadas
          },
          reglasAplicadas
        };
      }
    }

    return { decidido: false, resultado: null, reglasAplicadas };
  }

  /**
   * Construye la DecisionCore de fallback (aprobacion por defecto), incluyendo
   * todas las reglas evaluadas y el identificador DEFAULT_APROBADO (RF-06 crit. 4).
   * @param {string[]} acumulado nombres de todas las reglas evaluadas
   * @returns {{decision: string, motivo: string, reglasAplicadas: string[]}}
   */
  static _fallback(acumulado) {
    return {
      decision: "APROBADO",
      motivo: "Cumple con todas las politicas de credito vigentes",
      reglasAplicadas: MotorReglas._acumular(acumulado, DEFAULT_APROBADO)
    };
  }

  /**
   * Fase interna: ejecuta solo las reglas que NO requieren buro.
   *
   * @param {Object|null} historial Historial_Interno (null = cliente nuevo)
   * @param {Object} solicitud SolicitudCore
   * @returns {{decidido: boolean, resultado: Object|null, reglasAplicadas: string[]}}
   *   - `decidido: true` con `resultado` = { decision, motivo, reglasAplicadas }
   *     cuando una regla interna emite veredicto.
   *   - `decidido: false` con `reglasAplicadas` = acumulado de la fase interna
   *     cuando ninguna regla interna decide (el llamador debe consultar el buro
   *     y luego invocar `continuar`).
   */
  ejecutarInternas(historial, solicitud) {
    const reglasInternas = this.reglas.filter((r) => r.requiereBuro === false);
    return MotorReglas._recorrer(reglasInternas, historial, null, solicitud, []);
  }

  /**
   * Fase con buro: continua la cadena con las reglas restantes (las que
   * requieren buro), preservando el acumulado de la fase interna.
   *
   * @param {Object|null} historial Historial_Interno
   * @param {Object} buro Datos_Buro normalizado
   * @param {Object} solicitud SolicitudCore
   * @param {Object} [estadoPrevio] estado devuelto por `ejecutarInternas`
   *   (se usa `reglasAplicadas` para preservar el acumulado entre fases)
   * @returns {{decision: string, motivo: string, reglasAplicadas: string[]}}
   *   DecisionCore parcial siempre resuelta (regla de buro o fallback).
   */
  continuar(historial, buro, solicitud, estadoPrevio = {}) {
    const acumuladoPrevio = Array.isArray(estadoPrevio.reglasAplicadas)
      ? estadoPrevio.reglasAplicadas
      : [];
    const reglasBuro = this.reglas.filter((r) => r.requiereBuro === true);

    const fase = MotorReglas._recorrer(
      reglasBuro,
      historial,
      buro,
      solicitud,
      acumuladoPrevio
    );

    if (fase.decidido) {
      return fase.resultado;
    }

    return MotorReglas._fallback(fase.reglasAplicadas);
  }

  /**
   * Ejecucion completa de la cadena en un solo paso (sin consulta perezosa).
   *
   * Util para pruebas de dominio y para llamadas que ya disponen de historial y
   * buro. Recorre toda la cadena en orden y devuelve la DecisionCore con
   * `reglasAplicadas` acumulado; aplica el fallback si ninguna regla decide.
   *
   * @param {Object|null} historial Historial_Interno
   * @param {Object|null} buro Datos_Buro normalizado (puede ser null si no se consulto)
   * @param {Object} solicitud SolicitudCore
   * @returns {{decision: string, motivo: string, reglasAplicadas: string[]}}
   */
  ejecutar(historial, buro, solicitud) {
    const fase = MotorReglas._recorrer(this.reglas, historial, buro, solicitud, []);
    if (fase.decidido) {
      return fase.resultado;
    }
    return MotorReglas._fallback(fase.reglasAplicadas);
  }
}

MotorReglas.DEFAULT_APROBADO = DEFAULT_APROBADO;

module.exports = MotorReglas;
