const fc = require("fast-check");
const { crearMemoriaResultadoEvaluacionRepository } = require("../repositories/memoriaResultadoEvaluacionRepository");
const { crearEvaluacionPosService } = require("./evaluacionPosService");

const SOLICITUD_CORE = { identificacion: "1720000002", montoSolicitado: 450, plazoMeses: 12, tiendaId: "TIENDA-001" };

function crearDobles(decisionCore) {
  const coreClient = {
    solicitarEvaluacion: jest.fn(async () => decisionCore),
    obtenerEvaluacionPorId: jest.fn(async () => decisionCore)
  };
  const resultadoRepository = crearMemoriaResultadoEvaluacionRepository({ ttlMs: 60000, maxEntradas: 100 });
  return { coreClient, resultadoRepository, servicio: crearEvaluacionPosService({ coreClient, resultadoRepository }) };
}

function decisionCore(id, decision = "APROBADO") {
  return { idEvaluacion: id, decision, motivo: "ok", fecha: new Date().toISOString(), consultaBuroRealizada: false, reglasAplicadas: [] };
}

describe("evaluacionPosService", () => {
  // Feature: bff-punto-venta, Property 7: Ida y vuelta por caché sin volver al core
  it("Property 7: ida y vuelta por cache sin volver al core", async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), fc.constantFrom("APROBADO", "RECHAZADO", "REVISION_MANUAL"), async (id, decision) => {
        const { coreClient, servicio } = crearDobles(decisionCore(id, decision));
        const registrado = await servicio.registrarEvaluacion(SOLICITUD_CORE);
        const consultado = await servicio.consultarEstado(id);

        expect(consultado).toEqual(registrado);
        expect(coreClient.obtenerEvaluacionPorId).not.toHaveBeenCalled();
      }),
      { numRuns: 100 }
    );
  });

  it("registrarEvaluacion llama al core exactamente una vez", async () => {
    const { coreClient, servicio } = crearDobles(decisionCore("3f2504e0-4f89-41d3-9a0c-0305e82c3301"));
    await servicio.registrarEvaluacion(SOLICITUD_CORE);
    expect(coreClient.solicitarEvaluacion).toHaveBeenCalledTimes(1);
    expect(coreClient.solicitarEvaluacion).toHaveBeenCalledWith(SOLICITUD_CORE);
  });

  it("consultarEstado con miss consulta al core, guarda y la siguiente lectura no vuelve al core", async () => {
    const id = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
    const { coreClient, servicio } = crearDobles(decisionCore(id));
    const primero = await servicio.consultarEstado(id);
    const segundo = await servicio.consultarEstado(id);

    expect({ ...primero }).toEqual({ idEvaluacion: id, decision: "APROBADO" });
    expect(segundo).toEqual(primero);
    expect(coreClient.obtenerEvaluacionPorId).toHaveBeenCalledTimes(1);
  });

  it("la respuesta placeholder actual del core produce 502 y no se guarda", async () => {
    const id = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
    const { resultadoRepository, servicio } = crearDobles({ idEvaluacion: id, status: "COMPLETADA" });
    await expect(servicio.consultarEstado(id)).rejects.toMatchObject({ status: 502, code: "ERROR_EVALUACION" });
    expect(resultadoRepository.tamanio()).toBe(0);
  });
});
