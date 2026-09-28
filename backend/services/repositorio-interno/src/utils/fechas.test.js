const fc = require("fast-check");
const { mesesCompletosEntre, aFechaIso } = require("./fechas");
const ClienteHistorial = require("../models/clienteHistorial");

const MS_DIA = 24 * 60 * 60 * 1000;
const arbFecha = fc.date({ min: new Date("1990-01-01T00:00:00Z"), max: new Date("2035-12-31T00:00:00Z"), noInvalidDate: true });

describe("mesesCompletosEntre / ClienteHistorial.antiguedadMeses", () => {
  // Feature: repositorio-interno, Property 2: antiguedadMeses cuenta meses completos, nunca es negativa y no decrece con el tiempo
  it("Property 2: cuenta meses completos, nunca es negativa y no decrece con el tiempo", () => {
    fc.assert(
      fc.property(arbFecha, arbFecha, arbFecha, (registro, x, y) => {
        const [a1, a2] = x <= y ? [x, y] : [y, x];
        const cliente = new ClienteHistorial({
          identificacion: "X",
          tieneMoraVigente: false,
          creditosPrevios: 0,
          ingresosDeclarados: null,
          fechaPrimerRegistro: aFechaIso(registro)
        });
        const m1 = cliente.antiguedadMeses(a1);
        const m2 = cliente.antiguedadMeses(a2);

        expect(Number.isInteger(m1)).toBe(true);
        expect(m1).toBeGreaterThanOrEqual(0);
        expect(m1).toBeLessThanOrEqual(m2);

        // Oraculo independiente de la formula: k meses completos implican al
        // menos 28k dias y menos de 31(k+1) dias transcurridos.
        const inicio = Date.UTC(registro.getUTCFullYear(), registro.getUTCMonth(), registro.getUTCDate());
        const fin = Date.UTC(a1.getUTCFullYear(), a1.getUTCMonth(), a1.getUTCDate());
        const dias = Math.round((fin - inicio) / MS_DIA);
        if (dias < 0) {
          expect(m1).toBe(0);
        } else {
          expect(dias).toBeGreaterThanOrEqual(28 * m1);
          expect(dias).toBeLessThan(31 * (m1 + 1));
        }
      }),
      { numRuns: 100 }
    );
  });

  it.each([
    ["2024-01-15", "2024-02-15", 1, "mismo dia del mes siguiente"],
    ["2024-01-15", "2024-02-14", 0, "un dia antes"],
    ["2024-01-31", "2024-02-29", 0, "fin de mes sin dia 31"],
    ["2024-01-31", "2024-03-31", 2, "fin de mes con dia 31"],
    ["2021-01-20", "2026-09-24", 68, "cliente de buen historial"],
    ["2030-01-01", "2026-09-24", 0, "fecha futura"]
  ])("%s -> %s = %i (%s)", (registro, ahora, esperado) => {
    expect(mesesCompletosEntre(registro, new Date(`${ahora}T12:00:00Z`))).toBe(esperado);
  });

  it("acepta un Date a medianoche UTC igual que el texto", () => {
    const ahora = new Date("2026-09-24T12:00:00Z");
    expect(mesesCompletosEntre(new Date("2021-01-20T00:00:00Z"), ahora)).toBe(mesesCompletosEntre("2021-01-20", ahora));
    expect(aFechaIso(new Date("2021-01-20T00:00:00Z"))).toBe("2021-01-20");
  });
});
