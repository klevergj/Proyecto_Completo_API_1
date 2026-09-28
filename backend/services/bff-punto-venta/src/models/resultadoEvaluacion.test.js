const fc = require("fast-check");
const { ErrorBff } = require("../utils/errorBff");
const ResultadoEvaluacion = require("./resultadoEvaluacion");

const DECISIONES = ResultadoEvaluacion.DECISIONES;

describe("ResultadoEvaluacion.desdeDecisionCore", () => {
  // Feature: bff-punto-venta, Property 4: Una DecisionCore inválida nunca produce un resultado
  it("Property 4: una DecisionCore invalida nunca produce un resultado", () => {
    const arbDecisionInvalida = fc.oneof(
      fc.string().filter((s) => !DECISIONES.includes(s)),
      fc.constant(null),
      fc.constant(undefined),
      fc.integer(),
      fc.boolean()
    );
    const arbIdInvalido = fc.oneof(fc.constant(""), fc.constant("   "), fc.constant(null), fc.integer(), fc.constant(undefined));

    const arbInvalida = fc.oneof(
      fc.record({ idEvaluacion: fc.uuid(), decision: arbDecisionInvalida }),
      fc.record({ idEvaluacion: arbIdInvalido, decision: fc.constantFrom(...DECISIONES) }),
      fc.constantFrom(null, undefined, "APROBADO", 42, [])
    );

    fc.assert(
      fc.property(arbInvalida, (entrada) => {
        let lanzado;
        try {
          ResultadoEvaluacion.desdeDecisionCore(entrada);
        } catch (e) {
          lanzado = e;
        }
        expect(lanzado).toBeInstanceOf(ErrorBff);
        expect(lanzado.status).toBe(502);
        expect(lanzado.code).toBe("ERROR_EVALUACION");
      }),
      { numRuns: 100 }
    );
  });

  it("conserva solo idEvaluacion y decision, y es inmutable", () => {
    const resultado = ResultadoEvaluacion.desdeDecisionCore({
      idEvaluacion: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
      decision: "APROBADO",
      motivo: "x",
      reglasAplicadas: []
    });
    expect({ ...resultado }).toEqual({ idEvaluacion: "3f2504e0-4f89-41d3-9a0c-0305e82c3301", decision: "APROBADO" });
    expect(Object.isFrozen(resultado)).toBe(true);
  });
});
