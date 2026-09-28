const fc = require("fast-check");
const { toHistorialClienteDto } = require("./historialClienteDto");
const { filaAClienteHistorial } = require("../repositories/postgresHistorialRepository");

const arbFecha = fc.date({ min: new Date("1990-01-01T00:00:00Z"), max: new Date("2035-12-31T00:00:00Z"), noInvalidDate: true });

const arbFila = fc.record({
  identificacion: fc.stringMatching(/^[0-9A-Za-z-]{1,20}$/),
  tiene_mora_vigente: fc.boolean(),
  creditos_previos: fc.nat({ max: 1000 }),
  ingresos_declarados: fc.option(
    fc.integer({ min: 1, max: 99999999999 }).chain((c) => fc.constantFrom(c / 100, (c / 100).toFixed(2))),
    { nil: null }
  ),
  fecha_primer_registro: arbFecha.map((d) => d.toISOString().slice(0, 10))
});

describe("fila -> ClienteHistorial -> HistorialClienteDto", () => {
  // Feature: repositorio-interno, Property 1: HistorialCliente tiene exactamente cinco campos con los tipos del contrato
  it("Property 1: HistorialCliente tiene exactamente cinco campos con los tipos del contrato", () => {
    fc.assert(
      fc.property(arbFila, fc.dictionary(fc.string(), fc.anything()), arbFecha, (fila, extras, ahora) => {
        const dto = toHistorialClienteDto(filaAClienteHistorial({ ...extras, ...fila }), ahora);

        expect(Object.keys(dto).sort()).toEqual([
          "antiguedadMeses",
          "creditosPrevios",
          "identificacion",
          "ingresosDeclarados",
          "tieneMoraVigente"
        ]);
        expect(dto.identificacion).toBe(fila.identificacion);
        expect(dto.tieneMoraVigente).toBe(fila.tiene_mora_vigente);
        expect(dto.creditosPrevios).toBe(fila.creditos_previos);
        if (fila.ingresos_declarados === null) {
          expect(dto.ingresosDeclarados).toBeNull();
        } else {
          expect(typeof dto.ingresosDeclarados).toBe("number");
          expect(dto.ingresosDeclarados).toBe(Number(fila.ingresos_declarados));
        }
        expect(Number.isInteger(dto.antiguedadMeses)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});
