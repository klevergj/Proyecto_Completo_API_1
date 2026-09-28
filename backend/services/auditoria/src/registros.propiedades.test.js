const fc = require("fast-check");
const request = require("supertest");
const { crearApp } = require("./app");
const { crearMemoriaRegistroAuditoriaRepository } = require("./repositories/memoriaRegistroAuditoriaRepository");
const RegistroAuditoria = require("./models/registroAuditoria");
const { arbRegistroEntrada, arbFiltros, cumpleFiltros, compararOrden } = require("./__helpers__/generadores");

const CONFIG = { paginaTamanoDefecto: 20, paginaTamanoMaximo: 100 };
const REGISTRADO_EN = new Date("2026-09-24T12:00:00.000Z");
const CAMPOS_SPEC7 = [
  "consultaBuroRealizada", "decision", "fecha", "idEvaluacion", "identificacion", "montoSolicitado",
  "motivo", "plazoMeses", "registradoEn", "reglasAplicadas", "scoreBuro", "tiendaId"
];

function appNueva() {
  const registroRepository = crearMemoriaRegistroAuditoriaRepository();
  const app = crearApp({ registroRepository, verificarAlmacen: async () => true, config: CONFIG, ahora: () => REGISTRADO_EN });
  return { app, registroRepository };
}

/** Siembra directa en el repositorio (rapido) con ids unicos. */
async function sembrar(repo, registros) {
  const unicos = [...new Map(registros.map((r) => [r.idEvaluacion.toLowerCase(), r])).values()];
  for (const r of unicos) {
    await repo.guardar(new RegistroAuditoria({ ...r, idEvaluacion: r.idEvaluacion.toLowerCase(), registradoEn: REGISTRADO_EN }));
  }
  return unicos.map((r) => ({ ...r, idEvaluacion: r.idEvaluacion.toLowerCase() }));
}

const aQuery = (filtros, extra = {}) => new URLSearchParams({ ...filtros, ...extra }).toString();

describe("Servicio de Auditoria - propiedades", () => {
  // Feature: servicio-auditoria, Property 1: Ida y vuelta de un registro válido
  it("Property 1: ida y vuelta de un registro valido", async () => {
    await fc.assert(
      fc.asyncProperty(arbRegistroEntrada, fc.dictionary(fc.string().filter((k) => !CAMPOS_SPEC7.includes(k) && k !== "__proto__"), fc.jsonValue()), async (entrada, extras) => {
        const { app } = appNueva();

        const creado = await request(app).post("/registros").send({ ...extras, ...entrada });
        expect(creado.status).toBe(201);

        const leido = await request(app).get(`/registros/${entrada.idEvaluacion}`);
        expect(leido.status).toBe(200);
        expect(Object.keys(leido.body).sort()).toEqual(CAMPOS_SPEC7);
        expect(leido.body.consultaBuroRealizada).toBe(entrada.consultaBuroRealizada);
        expect(leido.body.reglasAplicadas).toEqual(entrada.reglasAplicadas);
        expect(leido.body.fecha).toBe(new Date(entrada.fecha).toISOString());
        expect(leido.body.scoreBuro).toBe(entrada.scoreBuro === undefined ? null : entrada.scoreBuro);
        expect(leido.body.tiendaId).toBe(entrada.tiendaId === undefined ? null : entrada.tiendaId);
        expect(leido.body.registradoEn).toBe(REGISTRADO_EN.toISOString());
      }),
      { numRuns: 100 }
    );
  });

  // Feature: servicio-auditoria, Property 2: Un registro inválido se rechaza sin persistir
  it("Property 2: un registro invalido se rechaza sin persistir", async () => {
    const mutaciones = fc.oneof(
      fc.record({ idEvaluacion: fc.oneof(fc.string(), fc.integer(), fc.constant(null)) }).filter((m) => typeof m.idEvaluacion !== "string" || !/^[0-9a-f-]{36}$/i.test(m.idEvaluacion)),
      fc.record({ decision: fc.oneof(fc.string().filter((s) => !["APROBADO", "RECHAZADO", "REVISION_MANUAL"].includes(s)), fc.constant(null)) }),
      fc.record({ fecha: fc.oneof(fc.constantFrom("2026-09-01", "ayer", "", "2026-13-01T00:00:00Z"), fc.integer()) }),
      fc.record({ consultaBuroRealizada: fc.oneof(fc.string(), fc.integer(), fc.constant(null)) }),
      fc.record({ reglasAplicadas: fc.oneof(fc.string(), fc.array(fc.integer(), { minLength: 1 }), fc.constant(null)) }),
      fc.record({ scoreBuro: fc.oneof(fc.string(), fc.double({ min: 0.1, max: 0.9, noNaN: true })) }),
      fc.record({ plazoMeses: fc.oneof(fc.string(), fc.double({ min: 1.1, max: 1.9, noNaN: true })) }),
      fc.record({ tiendaId: fc.oneof(fc.integer(), fc.boolean()) })
    );

    await fc.assert(
      fc.asyncProperty(arbRegistroEntrada, mutaciones, async (entrada, mutacion) => {
        const { app, registroRepository } = appNueva();

        const res = await request(app).post("/registros").send({ ...entrada, ...mutacion });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("REGISTRO_INVALIDO");
        expect((await registroRepository.buscar({ filtros: {}, page: 0, size: 10 })).total).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: servicio-auditoria, Property 3: El listado devuelve exactamente los registros que cumplen los filtros
  it("Property 3: el listado devuelve exactamente los registros que cumplen los filtros", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(arbRegistroEntrada, { maxLength: 30 }), arbFiltros, async (entradas, filtros) => {
        const { app, registroRepository } = appNueva();
        const sembrados = await sembrar(registroRepository, entradas);

        const res = await request(app).get(`/registros?${aQuery(filtros, { size: "100" })}`);

        expect(res.status).toBe(200);
        expect(res.body.total).toBe(sembrados.filter((r) => cumpleFiltros(r, filtros)).length);
        for (const item of res.body.items) {
          expect(cumpleFiltros(item, filtros)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  // Feature: servicio-auditoria, Property 4: La paginación es estable, completa y acotada
  it("Property 4: la paginacion es estable, completa y acotada", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(arbRegistroEntrada, { maxLength: 25 }),
        arbFiltros,
        fc.integer({ min: 1, max: 7 }),
        async (entradas, filtros, size) => {
          const { app, registroRepository } = appNueva();
          const sembrados = await sembrar(registroRepository, entradas);
          const esperados = sembrados
            .filter((r) => cumpleFiltros(r, filtros))
            .map((r) => ({ ...r, fecha: new Date(r.fecha).toISOString() }))
            .sort(compararOrden)
            .map((r) => r.idEvaluacion);

          const vistos = [];
          const paginas = Math.ceil(esperados.length / size);
          for (let page = 0; page <= paginas; page++) {
            const res = await request(app).get(`/registros?${aQuery(filtros, { page: String(page), size: String(size) })}`);
            expect(res.status).toBe(200);
            expect(res.body.page).toBe(page);
            expect(res.body.size).toBe(size);
            expect(res.body.items.length).toBeLessThanOrEqual(size);
            if (page === paginas) expect(res.body.items).toEqual([]);
            vistos.push(...res.body.items.map((i) => i.idEvaluacion));
          }

          expect(vistos).toEqual(esperados);
        }
      ),
      { numRuns: 50 }
    );
  });

  // Feature: servicio-auditoria, Property 5: Parámetros de listado inválidos se rechazan con 400
  it("Property 5: parametros de listado invalidos se rechazan con 400", async () => {
    const invalidos = fc.oneof(
      fc.record({ page: fc.constantFrom("-1", "1.5", "abc", "", " 1") }),
      fc.record({ size: fc.oneof(fc.constantFrom("0", "101", "-5", "2.5", "x"), fc.integer({ min: 101, max: 10000 }).map(String)) }),
      fc.record({ estado: fc.string().filter((s) => !["APROBADO", "RECHAZADO", "REVISION_MANUAL"].includes(s)) }),
      fc.record({ fechaDesde: fc.constantFrom("2026-02-30", "2026-9-1", "hoy", "2026-13-01") }),
      fc.record({ fechaDesde: fc.constant("2026-09-10"), fechaHasta: fc.constant("2026-09-01") })
    );

    await fc.assert(
      fc.asyncProperty(invalidos, async (query) => {
        const registroRepository = { inicializar: jest.fn(), guardar: jest.fn(), buscarPorId: jest.fn(), buscar: jest.fn() };
        const app = crearApp({ registroRepository, verificarAlmacen: async () => true, config: CONFIG });

        const res = await request(app).get(`/registros?${new URLSearchParams(query).toString()}`);

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("PARAMETRO_INVALIDO");
        expect(registroRepository.buscar).not.toHaveBeenCalled();
      }),
      { numRuns: 100 }
    );
  });

  // Feature: servicio-auditoria, Property 6: Un duplicado se rechaza y el original no cambia
  it("Property 6: un duplicado se rechaza y el original no cambia", async () => {
    await fc.assert(
      fc.asyncProperty(arbRegistroEntrada, arbRegistroEntrada, async (primero, segundo) => {
        const { app } = appNueva();
        const duplicado = { ...segundo, idEvaluacion: primero.idEvaluacion };

        expect((await request(app).post("/registros").send(primero)).status).toBe(201);
        const res = await request(app).post("/registros").send(duplicado);
        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe("REGISTRO_DUPLICADO");

        const leido = await request(app).get(`/registros/${primero.idEvaluacion}`);
        expect(leido.body.decision).toBe(primero.decision);
        expect(leido.body.fecha).toBe(new Date(primero.fecha).toISOString());
      }),
      { numRuns: 100 }
    );
  });
});
