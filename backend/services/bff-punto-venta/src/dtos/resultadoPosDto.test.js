const fc = require("fast-check");
const ResultadoEvaluacion = require("../models/resultadoEvaluacion");
const { MENSAJES_POR_DECISION, toResultadoPosDto } = require("./resultadoPosDto");

const arbDecisionCore = fc.record({
  idEvaluacion: fc.uuid(),
  decision: fc.constantFrom(...ResultadoEvaluacion.DECISIONES),
  motivo: fc.string(),
  fecha: fc.date({ noInvalidDate: true }).map((d) => d.toISOString()),
  consultaBuroRealizada: fc.boolean(),
  reglasAplicadas: fc.array(fc.string())
});

// DecisionCore -> modelo -> DTO, como lo hacen el servicio y el controlador.
const aResultadoPos = (decisionCore) => toResultadoPosDto(ResultadoEvaluacion.desdeDecisionCore(decisionCore));

describe("toResultadoPosDto", () => {
  // Feature: bff-punto-venta, Property 1: aprobado es verdadero si y solo si la decisión es APROBADO
  it("Property 1: aprobado es verdadero si y solo si la decision es APROBADO", () => {
    fc.assert(
      fc.property(arbDecisionCore, (d) => {
        expect(aResultadoPos(d).aprobado).toBe(d.decision === "APROBADO");
      }),
      { numRuns: 100 }
    );
  });

  // Feature: bff-punto-venta, Property 2: El mensaje depende solo de la decisión y nunca expone el motivo
  it("Property 2: el mensaje depende solo de la decision y nunca expone el motivo", () => {
    fc.assert(
      fc.property(arbDecisionCore, fc.string(), (d, otroMotivo) => {
        const a = aResultadoPos(d);
        const b = aResultadoPos({ ...d, motivo: otroMotivo });
        expect(a.mensajeParaCliente).toBe(MENSAJES_POR_DECISION[d.decision]);
        expect(b.mensajeParaCliente).toBe(a.mensajeParaCliente);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: bff-punto-venta, Property 3: ResultadoPos tiene exactamente tres campos y preserva el idEvaluacion
  it("Property 3: ResultadoPos tiene exactamente tres campos y preserva el idEvaluacion", () => {
    fc.assert(
      fc.property(arbDecisionCore, fc.dictionary(fc.string(), fc.anything()), (d, extras) => {
        const resultado = aResultadoPos({ ...extras, ...d });
        expect(Object.keys(resultado).sort()).toEqual(["aprobado", "idEvaluacion", "mensajeParaCliente"]);
        expect(resultado.idEvaluacion).toBe(d.idEvaluacion);
      }),
      { numRuns: 100 }
    );
  });

  describe("textos exactos (RF-03 crit. 1-3)", () => {
    const id = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
    it.each([
      ["APROBADO", true, "Crédito aprobado"],
      ["REVISION_MANUAL", false, "En revisión, te contactaremos"],
      ["RECHAZADO", false, "Crédito no aprobado en esta ocasión"]
    ])("%s -> aprobado=%s, mensaje '%s'", (decision, aprobado, mensaje) => {
      expect(aResultadoPos({ idEvaluacion: id, decision, motivo: "Mora vigente" })).toEqual({
        idEvaluacion: id,
        aprobado,
        mensajeParaCliente: mensaje
      });
    });
  });
});
