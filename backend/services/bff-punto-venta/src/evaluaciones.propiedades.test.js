const fc = require("fast-check");
const request = require("supertest");
const { crearApp } = require("./app");
const { crearMemoriaResultadoEvaluacionRepository } = require("./repositories/memoriaResultadoEvaluacionRepository");

const CAMPOS = ["identificacion", "montoSolicitado", "plazoMeses", "tiendaId"];
const espacios = fc.constantFrom("", " ", "  ", "\t");
const arbTextoNoVacio = fc
  .tuple(espacios, fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0), espacios)
  .map(([a, s, b]) => a + s + b);

const arbSolicitudValida = fc.record({
  identificacion: arbTextoNoVacio,
  montoSolicitado: fc.double({ min: Number.MIN_VALUE, max: 1e9, noNaN: true, noDefaultInfinity: true }),
  plazoMeses: fc.integer({ min: 1, max: 360 }),
  tiendaId: arbTextoNoVacio
});

function appConDobles() {
  const coreClient = {
    solicitarEvaluacion: jest.fn(async () => ({
      idEvaluacion: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
      decision: "APROBADO",
      motivo: "ok"
    })),
    obtenerEvaluacionPorId: jest.fn()
  };
  const resultadoRepository = crearMemoriaResultadoEvaluacionRepository({ ttlMs: 60000, maxEntradas: 100 });
  return { app: crearApp({ coreClient, resultadoRepository }), coreClient };
}

describe("POST /evaluaciones-credito - propiedades", () => {
  // Feature: bff-punto-venta, Property 5: La traducción de la solicitud preserva los valores y usa lista blanca
  it("Property 5: la traduccion de la solicitud preserva los valores y usa lista blanca", async () => {
    await fc.assert(
      fc.asyncProperty(
        arbSolicitudValida,
        fc.dictionary(fc.string().filter((k) => !CAMPOS.includes(k) && k !== "__proto__"), fc.jsonValue()),
        async (solicitud, extras) => {
          const { app, coreClient } = appConDobles();

          const res = await request(app).post("/evaluaciones-credito").send({ ...extras, ...solicitud });

          expect(res.status).toBe(200);
          expect(coreClient.solicitarEvaluacion).toHaveBeenCalledTimes(1);
          const enviada = coreClient.solicitarEvaluacion.mock.calls[0][0];
          expect(Object.keys(enviada).sort()).toEqual([...CAMPOS].sort());
          expect(enviada).toEqual({
            identificacion: solicitud.identificacion.trim(),
            montoSolicitado: solicitud.montoSolicitado,
            plazoMeses: solicitud.plazoMeses,
            tiendaId: solicitud.tiendaId.trim()
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: bff-punto-venta, Property 6: Una solicitud inválida se rechaza con 400 sin tocar el core
  it("Property 6: una solicitud invalida se rechaza con 400 sin tocar el core", async () => {
    const mutaciones = fc.oneof(
      fc.record({ identificacion: fc.oneof(espacios, fc.integer(), fc.constant(null)) }),
      fc.record({ montoSolicitado: fc.oneof(fc.double({ max: 0, noNaN: true, noDefaultInfinity: true }), fc.string(), fc.constant(null)) }),
      fc.record({
        plazoMeses: fc.oneof(
          fc.integer({ max: 0 }),
          fc.double({ min: 0.1, max: 100, noNaN: true }).filter((n) => !Number.isInteger(n)),
          fc.string()
        )
      }),
      fc.record({ tiendaId: fc.oneof(espacios, fc.integer(), fc.constant(null)) })
    );

    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.tuple(arbSolicitudValida, mutaciones).map(([s, m]) => ({ ...s, ...m })),
          fc.constantFrom([], "texto", 42)
        ),
        async (body) => {
          const { app, coreClient } = appConDobles();

          const res = await request(app).post("/evaluaciones-credito").set("Content-Type", "application/json").send(JSON.stringify(body));

          expect(res.status).toBe(400);
          expect(res.body.error.code).toBe("SOLICITUD_INVALIDA");
          expect(coreClient.solicitarEvaluacion).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });
});
