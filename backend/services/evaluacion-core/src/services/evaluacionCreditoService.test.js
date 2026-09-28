const fc = require("fast-check");
const HistorialCliente = require("../models/historialCliente");
const DatosBuro = require("../models/datosBuro");
const { crearEvaluacionCreditoService } = require("./evaluacionCreditoService");

const DECISIONES = ["APROBADO", "RECHAZADO", "REVISION_MANUAL"];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const arbSolicitud = fc.record({
  identificacion: fc.stringMatching(/^[0-9]{10}$/),
  montoSolicitado: fc.double({ min: 1, max: 1e6, noNaN: true }),
  plazoMeses: fc.integer({ min: 1, max: 360 }),
  tiendaId: fc.constantFrom("TIENDA-001", "CENTRO-SUR-03")
});

const arbHistorial = (tieneMoraVigente) =>
  fc
    .record({
      identificacion: fc.stringMatching(/^[0-9]{10}$/),
      tieneMoraVigente: tieneMoraVigente === undefined ? fc.boolean() : fc.constant(tieneMoraVigente),
      creditosPrevios: fc.nat({ max: 20 }),
      ingresosDeclarados: fc.option(fc.double({ min: 1, max: 1e5, noNaN: true }), { nil: null }),
      antiguedadMeses: fc.nat({ max: 240 })
    })
    .map((d) => new HistorialCliente(d));

const arbDatosBuro = fc.oneof(
  fc.constant(DatosBuro.indisponible()),
  fc
    .record({
      score: fc.integer({ min: 300, max: 850 }),
      moraExterna: fc.boolean(),
      deudaExternaTotal: fc.nat({ max: 10000 })
    })
    .map((d) => new DatosBuro({ ...d, estadoBuro: "DISPONIBLE" }))
);

function crearDobles({ historial, datosBuro = DatosBuro.indisponible() }) {
  const historialClienteRepository = { buscarPorIdentificacion: jest.fn(async () => historial) };
  const datosBuroRepository = { obtenerPorIdentificacion: jest.fn(async () => datosBuro) };
  const auditoriaPublisher = { publicarEvento: jest.fn() };
  const servicio = crearEvaluacionCreditoService({ historialClienteRepository, datosBuroRepository, auditoriaPublisher });
  return { servicio, historialClienteRepository, datosBuroRepository, auditoriaPublisher };
}

describe("evaluacionCreditoService", () => {
  // Feature: motor-decision-credito, Property 1: Mora vigente rechaza sin tocar el buró
  it("Property 1: mora vigente rechaza sin tocar el buro", async () => {
    await fc.assert(
      fc.asyncProperty(arbSolicitud, arbHistorial(true), async (solicitud, historial) => {
        const { servicio, datosBuroRepository } = crearDobles({ historial });
        const d = await servicio.evaluar(solicitud);

        expect(d.decision).toBe("RECHAZADO");
        expect(d.consultaBuroRealizada).toBe(false);
        expect(datosBuroRepository.obtenerPorIdentificacion).not.toHaveBeenCalled();
      }),
      { numRuns: 100 }
    );
  });

  // Feature: motor-decision-credito, Property 3: Monto bajo con historial limpio aprueba sin buró
  it("Property 3: monto bajo con historial limpio aprueba sin buro", async () => {
    await fc.assert(
      fc.asyncProperty(
        arbSolicitud,
        fc.double({ min: 0.01, max: 500, noNaN: true }),
        arbHistorial(false),
        async (solicitud, montoBajo, historial) => {
          const { servicio, datosBuroRepository } = crearDobles({ historial });
          const d = await servicio.evaluar({ ...solicitud, montoSolicitado: montoBajo });

          expect(d.decision).toBe("APROBADO");
          expect(d.consultaBuroRealizada).toBe(false);
          expect(datosBuroRepository.obtenerPorIdentificacion).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: motor-decision-credito, Property 7: Fallo o timeout del buró nunca produce excepción no controlada
  it("Property 7: con el buro indisponible siempre produce una DecisionCore valida", async () => {
    await fc.assert(
      fc.asyncProperty(arbSolicitud, fc.option(arbHistorial(), { nil: null }), async (solicitud, historial) => {
        const { servicio } = crearDobles({ historial, datosBuro: DatosBuro.indisponible() });
        const d = await servicio.evaluar(solicitud);

        expect(DECISIONES).toContain(d.decision);
        expect(d.reglasAplicadas.length).toBeGreaterThan(0);
        if (historial === null) {
          // Cliente nuevo sin datos de buro -> revision manual (RF-07 crit. 4).
          expect(d.decision).toBe("REVISION_MANUAL");
        }
      }),
      { numRuns: 100 }
    );
  });

  // Feature: motor-decision-credito, Property 8: consultaBuroRealizada es verdadero si y solo si se invocó el adapter del buró
  it("Property 8: consultaBuroRealizada es verdadero si y solo si se invoco el repositorio del buro", async () => {
    await fc.assert(
      fc.asyncProperty(
        arbSolicitud,
        fc.option(arbHistorial(), { nil: null }),
        arbDatosBuro,
        async (solicitud, historial, datosBuro) => {
          const { servicio, datosBuroRepository } = crearDobles({ historial, datosBuro });
          const d = await servicio.evaluar(solicitud);

          expect(d.consultaBuroRealizada).toBe(datosBuroRepository.obtenerPorIdentificacion.mock.calls.length > 0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("idEvaluacion es un UUID v4 y la DecisionCore tiene los campos del contrato", async () => {
    const { servicio } = crearDobles({ historial: null });
    const d = await servicio.evaluar({ identificacion: "1730000003", montoSolicitado: 1200, plazoMeses: 12 });

    expect(d.idEvaluacion).toMatch(UUID_REGEX);
    expect(Object.keys(d).sort()).toEqual(
      ["consultaBuroRealizada", "decision", "fecha", "idEvaluacion", "motivo", "reglasAplicadas"]
    );
  });

  it("publica auditoria en cada decision, incluido el fallback del buro", async () => {
    const { servicio, auditoriaPublisher } = crearDobles({ historial: null, datosBuro: DatosBuro.indisponible() });
    const d = await servicio.evaluar({ identificacion: "1730000003", montoSolicitado: 1200, plazoMeses: 12, tiendaId: "T1" });

    expect(auditoriaPublisher.publicarEvento).toHaveBeenCalledTimes(1);
    expect(auditoriaPublisher.publicarEvento).toHaveBeenCalledWith(
      expect.objectContaining({ idEvaluacion: d.idEvaluacion, consultaBuroRealizada: true, scoreBuro: null, tiendaId: "T1" })
    );
  });

  it("un fallo del historial interno se propaga (dato imprescindible)", async () => {
    const historialClienteRepository = { buscarPorIdentificacion: jest.fn().mockRejectedValue(new Error("caido")) };
    const servicio = crearEvaluacionCreditoService({
      historialClienteRepository,
      datosBuroRepository: { obtenerPorIdentificacion: jest.fn() },
      auditoriaPublisher: { publicarEvento: jest.fn() }
    });
    await expect(servicio.evaluar({ identificacion: "1", montoSolicitado: 1, plazoMeses: 1 })).rejects.toThrow("caido");
  });

  it.each([
    ["historial", { datosBuroRepository: { obtenerPorIdentificacion: jest.fn() } }, 'HistorialClienteRepository invalido: falta el metodo "buscarPorIdentificacion"'],
    ["buro", { historialClienteRepository: { buscarPorIdentificacion: jest.fn() } }, 'DatosBuroRepository invalido: falta el metodo "obtenerPorIdentificacion"']
  ])("rechaza un repositorio de %s que no cumple la interfaz", (_caso, deps, mensaje) => {
    expect(() => crearEvaluacionCreditoService({ auditoriaPublisher: { publicarEvento: jest.fn() }, ...deps })).toThrow(mensaje);
  });
});
