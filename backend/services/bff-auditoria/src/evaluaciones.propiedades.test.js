const fc = require("fast-check");
const request = require("supertest");
const { crearApp } = require("./app");
const EvaluacionAuditada = require("./models/evaluacionAuditada");
const { calcularTotalPaginas } = require("./dtos/auditoriaDtos");
const { traducirErrorAuditoria } = require("./utils/errorBffAuditoria");

const CONFIG = { paginaTamanoDefecto: 20, paginaTamanoMaximo: 100 };
const DECISIONES = ["APROBADO", "RECHAZADO", "REVISION_MANUAL"];
const PARAMS_PERMITIDOS = ["estado", "fechaDesde", "fechaHasta", "tiendaId", "page", "size"];
const CLAVES_RESUMEN = ["consultaBuroRealizada", "decision", "fecha", "idEvaluacion", "tiendaId"];
const CLAVES_DETALLE = [...CLAVES_RESUMEN, "identificacion", "montoSolicitado", "motivo", "plazoMeses", "registradoEn", "reglasAplicadas", "scoreBuro"].sort();

const arbDia = fc.integer({ min: 1, max: 28 }).map((d) => `2026-09-${String(d).padStart(2, "0")}`);

/** RegistroAuditoriaAlmacenado de Spec 7 (opcionales pueden faltar). */
const arbRegistro = fc.record(
  {
    idEvaluacion: fc.uuid(),
    fecha: fc.date({ min: new Date("2026-01-01T00:00:00Z"), max: new Date("2026-12-31T00:00:00Z"), noInvalidDate: true }).map((d) => d.toISOString()),
    decision: fc.constantFrom(...DECISIONES),
    consultaBuroRealizada: fc.boolean(),
    reglasAplicadas: fc.subarray(["REGLA_MORA_VIGENTE", "REGLA_CAPACIDAD_PAGO", "REGLA_SCORE_BURO", "REGLA_CLIENTE_NUEVO", "DEFAULT_APROBADO"]),
    tiendaId: fc.option(fc.constantFrom("TIENDA-001", "TIENDA-002"), { nil: null }),
    identificacion: fc.stringMatching(/^[0-9]{10}$/),
    montoSolicitado: fc.integer({ min: 1, max: 100000 }),
    plazoMeses: fc.integer({ min: 1, max: 360 }),
    motivo: fc.string({ maxLength: 40 }),
    scoreBuro: fc.option(fc.integer({ min: 300, max: 850 }), { nil: null }),
    registradoEn: fc.constant("2026-09-24T12:00:00.000Z")
  },
  { requiredKeys: ["idEvaluacion", "fecha", "decision", "consultaBuroRealizada", "reglasAplicadas"] }
);

const arbListadoValido = fc
  .record(
    {
      estado: fc.constantFrom(...DECISIONES),
      fechaDesde: arbDia,
      fechaHasta: arbDia,
      tiendaId: fc.constantFrom("TIENDA-001", "TIENDA-002"),
      page: fc.nat({ max: 50 }).map(String),
      size: fc.integer({ min: 1, max: 100 }).map(String)
    },
    { requiredKeys: [] }
  )
  .filter((q) => !(q.fechaDesde && q.fechaHasta && q.fechaDesde > q.fechaHasta));

function appConRepo(repo) {
  return crearApp({ registroRepository: repo, config: CONFIG });
}

describe("BFF Auditoria - propiedades", () => {
  // Feature: bff-auditoria, Property 1: El listado delega con lista blanca y devuelve resúmenes en el mismo orden
  it("Property 1: el listado delega con lista blanca y devuelve resumenes en el mismo orden", async () => {
    await fc.assert(
      fc.asyncProperty(
        arbListadoValido,
        fc.dictionary(fc.stringMatching(/^[a-z]{3,10}$/).filter((k) => !PARAMS_PERMITIDOS.includes(k)), fc.stringMatching(/^[a-z0-9]{1,8}$/)),
        fc.array(arbRegistro, { maxLength: 10 }),
        fc.nat({ max: 500 }),
        async (query, extras, registros, totalExtra) => {
          const items = registros.map(EvaluacionAuditada.desdeRegistro);
          const repo = { buscar: jest.fn(async (l) => ({ total: items.length + totalExtra, page: l.page, size: l.size, items })), buscarPorId: jest.fn() };

          const res = await request(appConRepo(repo)).get(`/evaluaciones?${new URLSearchParams({ ...extras, ...query })}`);

          expect(res.status).toBe(200);
          expect(repo.buscar).toHaveBeenCalledTimes(1);
          const enviado = repo.buscar.mock.calls[0][0];
          expect(Object.keys(enviado).every((k) => PARAMS_PERMITIDOS.includes(k))).toBe(true);
          expect(enviado.page).toBe(query.page === undefined ? 0 : Number(query.page));
          expect(enviado.size).toBe(query.size === undefined ? 20 : Number(query.size));
          for (const k of ["estado", "fechaDesde", "fechaHasta", "tiendaId"]) expect(enviado[k]).toBe(query[k]);

          expect(res.body.items.map((i) => i.idEvaluacion)).toEqual(registros.map((r) => r.idEvaluacion));
          for (const item of res.body.items) expect(Object.keys(item).sort()).toEqual(CLAVES_RESUMEN);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: bff-auditoria, Property 2: Parámetros inválidos se rechazan sin salir a red
  it("Property 2: parametros invalidos se rechazan sin salir a red", async () => {
    const invalidos = fc.oneof(
      fc.record({ estado: fc.string().filter((s) => !DECISIONES.includes(s)) }),
      fc.record({ fechaDesde: fc.constantFrom("2026-02-30", "2026-9-1", "hoy") }),
      fc.record({ fechaHasta: fc.constantFrom("2026-13-01", "31-12-2026") }),
      fc.record({ fechaDesde: fc.constant("2026-09-10"), fechaHasta: fc.constant("2026-09-01") }),
      fc.record({ page: fc.constantFrom("-1", "1.5", "x", "") }),
      fc.record({ size: fc.oneof(fc.constantFrom("0", "-1", "2.5", "x"), fc.integer({ min: 101, max: 9999 }).map(String)) })
    );

    await fc.assert(
      fc.asyncProperty(invalidos, async (query) => {
        const repo = { buscar: jest.fn(), buscarPorId: jest.fn() };
        const res = await request(appConRepo(repo)).get(`/evaluaciones?${new URLSearchParams(query)}`);

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("PARAMETRO_INVALIDO");
        expect(res.body.error.reintentable).toBe(false);
        expect(repo.buscar).not.toHaveBeenCalled();
      }),
      { numRuns: 100 }
    );
  });

  // Feature: bff-auditoria, Property 3: totalPaginas es consistente con total y size
  it("Property 3: totalPaginas es consistente con total y size", () => {
    fc.assert(
      fc.property(fc.nat({ max: 1000000 }), fc.integer({ min: 1, max: 100 }), (total, size) => {
        const n = calcularTotalPaginas(total, size);
        if (total === 0) {
          expect(n).toBe(0);
        } else {
          expect(n * size).toBeGreaterThanOrEqual(total);
          expect((n - 1) * size).toBeLessThan(total);
        }
      }),
      { numRuns: 100 }
    );
  });

  // Feature: bff-auditoria, Property 4: El detalle tiene siempre la forma completa y conserva los datos del analista
  it("Property 4: el detalle tiene siempre la forma completa y conserva los datos del analista", async () => {
    await fc.assert(
      fc.asyncProperty(arbRegistro, async (registro) => {
        const repo = { buscar: jest.fn(), buscarPorId: jest.fn(async () => EvaluacionAuditada.desdeRegistro(registro)) };

        const res = await request(appConRepo(repo)).get(`/evaluaciones/${registro.idEvaluacion}/detalle`);

        expect(res.status).toBe(200);
        expect(Object.keys(res.body).sort()).toEqual(CLAVES_DETALLE);
        expect(res.body.consultaBuroRealizada).toBe(registro.consultaBuroRealizada);
        expect(res.body.reglasAplicadas).toEqual(registro.reglasAplicadas);
        expect(res.body.scoreBuro).toBe(registro.scoreBuro === undefined ? null : registro.scoreBuro);
        for (const opcional of ["tiendaId", "identificacion", "montoSolicitado", "plazoMeses", "motivo", "registradoEn"]) {
          expect(res.body[opcional]).toBe(registro[opcional] === undefined ? null : registro[opcional]);
        }
      }),
      { numRuns: 100 }
    );
  });

  // Feature: bff-auditoria, Property 5: Todo fallo del Servicio de Auditoría se traduce sin filtraciones
  it("Property 5: todo fallo del Servicio de Auditoria se traduce sin filtraciones", () => {
    const MARCA = "SECRETO-";
    const esperado = (code, status) => {
      if (code === "ECONNABORTED" || code === "ETIMEDOUT") return 504;
      if (status === undefined) return 503;
      if (status === 400) return 400;
      if (status === 404) return 404;
      if (status === 503) return 503;
      return 502;
    };

    fc.assert(
      fc.property(
        fc.option(fc.constantFrom("ECONNABORTED", "ETIMEDOUT", "ECONNREFUSED", "ENOTFOUND", "ERR_BAD_RESPONSE"), { nil: undefined }),
        fc.option(fc.integer({ min: 400, max: 599 }), { nil: undefined }),
        fc.string(),
        (code, status, resto) => {
          const error = Object.assign(new Error(`${MARCA}${resto} http://auditoria:8095`), { code });
          if (status === undefined) error.request = {};
          else error.response = { status, data: { error: { message: `${MARCA}${resto}` } } };

          const traducido = traducirErrorAuditoria(error);
          const respuesta = traducido.toRespuesta();

          expect(Object.keys(respuesta.error).sort()).toEqual(["code", "message", "reintentable"]);
          expect(traducido.status).toBe(esperado(code, status));
          expect(JSON.stringify(respuesta)).not.toMatch(/SECRETO-|auditoria:8095/);
        }
      ),
      { numRuns: 100 }
    );
  });
});
