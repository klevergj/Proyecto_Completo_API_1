const fc = require("fast-check");
const { sembrar } = require("./seed");
const { REGISTROS_SEMILLA, IDENTIFICACIONES_SIN_HISTORIAL } = require("./seedData");
const { crearBaseEnMemoria, insertarRegistro, leerTabla } = require("../__helpers__/baseEnMemoria");
const { crearPostgresHistorialRepository } = require("../repositories/postgresHistorialRepository");
const { toHistorialClienteDto } = require("../dtos/historialClienteDto");

const IDS_SEMILLA = REGISTROS_SEMILLA.map((r) => r.identificacion);
const ESPERADO = [...REGISTROS_SEMILLA].map((r) => ({ ...r })).sort((a, b) => a.identificacion.localeCompare(b.identificacion));

function soloSemilla(tabla) {
  return tabla.filter((f) => IDS_SEMILLA.includes(f.identificacion) || IDENTIFICACIONES_SIN_HISTORIAL.includes(f.identificacion));
}

describe("sembrar", () => {
  // Feature: repositorio-interno, Property 6: La siembra es idempotente y garantiza la ausencia del cliente nuevo
  it("Property 6: la siembra es idempotente y garantiza la ausencia del cliente nuevo", async () => {
    const arbRegistroAlterado = fc.record({
      identificacion: fc.constantFrom(...IDS_SEMILLA, ...IDENTIFICACIONES_SIN_HISTORIAL),
      tiene_mora_vigente: fc.boolean(),
      creditos_previos: fc.nat({ max: 50 }),
      ingresos_declarados: fc.option(fc.integer({ min: 1, max: 100000 }), { nil: null }),
      fecha_primer_registro: fc.constantFrom("2000-01-01", "2015-07-31", "2026-02-28")
    });

    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(arbRegistroAlterado, { selector: (r) => r.identificacion, maxLength: 5 }),
        fc.boolean(),
        fc.integer({ min: 1, max: 5 }),
        async (previos, esquemaPrevio, n) => {
          const pool = await crearBaseEnMemoria({ conEsquema: esquemaPrevio || previos.length > 0 });
          for (const r of previos) await insertarRegistro(pool, r);

          for (let i = 0; i < n; i++) await sembrar(pool);

          expect(soloSemilla(await leerTabla(pool))).toEqual(ESPERADO);
        }
      ),
      { numRuns: 25 }
    );
  });

  describe("cobertura de los datos semilla (RF-03)", () => {
    let repo;
    beforeAll(async () => {
      const pool = await crearBaseEnMemoria({ conEsquema: false });
      await sembrar(pool);
      const repositorio = crearPostgresHistorialRepository({ pool });
      const ahora = new Date("2026-09-24T12:00:00Z");
      // Consulta a traves del repositorio y del DTO, como lo hace el controlador.
      repo = {
        buscarPorIdentificacion: async (id) => {
          const cliente = await repositorio.buscarPorIdentificacion(id);
          return cliente === null ? null : toHistorialClienteDto(cliente, ahora);
        }
      };
    });

    it("1710000001 tiene mora vigente", async () => {
      expect(await repo.buscarPorIdentificacion("1710000001")).toMatchObject({ tieneMoraVigente: true });
    });

    it("1720000002 tiene buen historial", async () => {
      const h = await repo.buscarPorIdentificacion("1720000002");
      expect(h).toEqual({
        identificacion: "1720000002",
        tieneMoraVigente: false,
        creditosPrevios: 6,
        ingresosDeclarados: 1500,
        antiguedadMeses: 68
      });
    });

    it("1730000003 no tiene historial (cliente nuevo)", async () => {
      expect(await repo.buscarPorIdentificacion("1730000003")).toBeNull();
    });

    it("1740000004 no tiene ingreso declarado", async () => {
      expect(await repo.buscarPorIdentificacion("1740000004")).toMatchObject({ tieneMoraVigente: false, ingresosDeclarados: null });
    });

    it("1750000005 tiene ingreso bajo: cuota 1200/6 supera el 35% del ingreso", async () => {
      const h = await repo.buscarPorIdentificacion("1750000005");
      expect(h.tieneMoraVigente).toBe(false);
      expect(1200 / 6 / h.ingresosDeclarados).toBeGreaterThan(0.35);
    });

    it("los datos semilla no contienen nombres ni otros campos personales", () => {
      for (const r of REGISTROS_SEMILLA) {
        expect(Object.keys(r).sort()).toEqual([
          "creditos_previos",
          "fecha_primer_registro",
          "identificacion",
          "ingresos_declarados",
          "tiene_mora_vigente"
        ]);
      }
    });
  });

  it("hace ROLLBACK y propaga el error si falla una sentencia", async () => {
    const consultas = [];
    const cliente = {
      query: jest.fn(async (sql) => {
        consultas.push(sql.trim().split(/\s+/)[0]);
        if (sql.includes("INSERT")) throw new Error("fallo");
      }),
      release: jest.fn()
    };
    await expect(sembrar({ connect: async () => cliente })).rejects.toThrow("fallo");
    expect(consultas).toContain("ROLLBACK");
    expect(consultas).not.toContain("COMMIT");
    expect(cliente.release).toHaveBeenCalled();
  });
});
