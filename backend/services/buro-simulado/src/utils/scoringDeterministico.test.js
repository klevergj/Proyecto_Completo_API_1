const fc = require("fast-check");
const { calcularScoreDeterministico } = require("./scoringDeterministico");

describe("calcularScoreDeterministico - propiedades del calculo del score", () => {
  // Feature: buro-simulado, Property 2: Invariante de rango del score [300,850]
  // Validates: Requisitos 1.2
  it("Property 2: el score es un entero dentro del rango [300, 850]", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (identificacion) => {
        const { score } = calcularScoreDeterministico(identificacion);
        expect(Number.isInteger(score)).toBe(true);
        expect(score).toBeGreaterThanOrEqual(300);
        expect(score).toBeLessThanOrEqual(850);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: buro-simulado, Property 1: Determinismo por identificación (score/mora/deuda estables)
  // Validates: Requisitos 1.3, 2.1, 2.2, 2.3
  it("Property 1: multiples invocaciones con la misma identificacion producen score, moraExterna y deudaExternaTotal identicos", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (identificacion) => {
        const primera = calcularScoreDeterministico(identificacion);
        const segunda = calcularScoreDeterministico(identificacion);
        const tercera = calcularScoreDeterministico(identificacion);

        expect(segunda.score).toBe(primera.score);
        expect(tercera.score).toBe(primera.score);

        expect(segunda.moraExterna).toBe(primera.moraExterna);
        expect(tercera.moraExterna).toBe(primera.moraExterna);

        expect(segunda.deudaExternaTotal).toBe(primera.deudaExternaTotal);
        expect(tercera.deudaExternaTotal).toBe(primera.deudaExternaTotal);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: buro-simulado, Property 3: Bicondicional deuda/mora
  // Validates: Requisitos 1.4, 1.5
  it("Property 3: deudaExternaTotal > 0 si y solo si moraExterna es true, y es 0 cuando moraExterna es false", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (identificacion) => {
        const { moraExterna, deudaExternaTotal } = calcularScoreDeterministico(identificacion);

        // Bicondicional: (deudaExternaTotal > 0) <=> (moraExterna === true)
        expect(deudaExternaTotal > 0).toBe(moraExterna === true);

        if (moraExterna === false) {
          expect(deudaExternaTotal).toBe(0);
        }
      }),
      { numRuns: 100 }
    );
  });
});
