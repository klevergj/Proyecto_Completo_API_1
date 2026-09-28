const fc = require("fast-check");
const request = require("supertest");
const { levantarJwks, firmarToken, otraClave } = require("./__helpers__/jwt");
const { levantarBffEco, crearAppPrueba } = require("./__helpers__/entorno");
const { TABLA_RUTAS, SCOPES } = require("./routes/tablaRutas");

// Las propiedades levantan apps por iteracion (P4, P6, P7) y pueden superar los
// 5 s por defecto de Jest bajo carga; el limite se ajusta a su duracion real.
jest.setTimeout(60000);

const TODOS_LOS_SCOPES = Object.values(SCOPES);
const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

/** Ruta publica concreta para una entrada de la tabla. */
const rutaPublica = (ruta, id = UUID) => ruta.plantilla.replace(":id", encodeURIComponent(id));
const pedir = (app, ruta, path, token) => {
  const r = request(app)[ruta.metodo.toLowerCase()](path);
  return token === undefined ? r : r.set("Authorization", token);
};

let jwks;
let bffPos;
let bffAuditoria;

beforeAll(async () => {
  jwks = await levantarJwks();
  bffPos = await levantarBffEco();
  bffAuditoria = await levantarBffEco();
});
afterAll(async () => {
  await jwks.cerrar();
  await bffPos.cerrar();
  await bffAuditoria.cerrar();
});

const invocaciones = () => bffPos.recibidas.length + bffAuditoria.recibidas.length;
const appBase = () => crearAppPrueba({ jwksUri: jwks.jwksUri, bffPosUrl: bffPos.url, bffAuditoriaUrl: bffAuditoria.url }).app;

describe("API Gateway - propiedades", () => {
  beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  // Feature: api-gateway, Property 1: Sin un token válido no se llega a ningún BFF
  it("Property 1: sin un token valido no se llega a ningun BFF", async () => {
    const app = appBase();
    const todos = TODOS_LOS_SCOPES.join(" ");
    const arbTokenInvalido = fc.oneof(
      fc.constant(undefined),
      fc.string().map((s) => `Bearer ${s}`),
      fc.string({ minLength: 1 }).map((s) => `Basic ${s}`),
      fc.constant(`Bearer ${firmarToken({ scope: todos }, { clave: otraClave.privateKey })}`),
      fc.constant(`Bearer ${firmarToken({ scope: todos }, { algoritmo: "HS256", clave: "secreto-compartido" })}`),
      fc.constant(`Bearer ${firmarToken({ scope: todos }, { expiraEn: -10 })}`),
      fc.constant(`Bearer ${firmarToken({ scope: todos }, { issuer: "http://otro-emisor/realms/x" })}`),
      fc.constant(`Bearer ${firmarToken({ scope: todos }, { audience: "otra-api" })}`),
      fc.constant(`Bearer ${firmarToken({ scope: todos }).split(".").slice(0, 2).join(".")}.`) // alg none / sin firma
    );

    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...TABLA_RUTAS), arbTokenInvalido, async (ruta, token) => {
        const antes = invocaciones();
        const res = await pedir(app, ruta, rutaPublica(ruta), token);

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe("NO_AUTENTICADO");
        expect(res.headers["www-authenticate"]).toMatch(/^Bearer/);
        expect(invocaciones()).toBe(antes);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: api-gateway, Property 2: El scope decide exactamente el acceso
  it("Property 2: el scope decide exactamente el acceso", async () => {
    const app = appBase();
    const parecidos = ["evaluaciones:leerx", "evaluaciones", "auditoria", "AUDITORIA:LEER", "evaluaciones:escribir2"];

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...TABLA_RUTAS),
        fc.subarray([...TODOS_LOS_SCOPES, ...parecidos]),
        fc.boolean(),
        async (ruta, scopes, comoArreglo) => {
          const claims = comoArreglo ? { scp: scopes } : { scope: scopes.join(" ") };
          const antes = invocaciones();
          const res = await pedir(app, ruta, rutaPublica(ruta), `Bearer ${firmarToken(claims)}`);

          if (scopes.includes(ruta.scope)) {
            expect(res.status).toBe(200);
            expect(invocaciones()).toBe(antes + 1);
          } else {
            expect(res.status).toBe(403);
            expect(res.body.error.code).toBe("SCOPE_INSUFICIENTE");
            expect(res.headers["www-authenticate"]).toContain(`scope="${ruta.scope}"`);
            expect(invocaciones()).toBe(antes);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: api-gateway, Property 3: El enrutamiento preserva método, ruta interna, query y cuerpo
  it("Property 3: el enrutamiento preserva metodo, ruta interna, query y cuerpo", async () => {
    const app = appBase();
    const token = `Bearer ${firmarToken({ scope: TODOS_LOS_SCOPES.join(" "), azp: "tienda-042" })}`;

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...TABLA_RUTAS),
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.dictionary(fc.stringMatching(/^[a-z]{1,8}$/), fc.string({ maxLength: 10 }), { maxKeys: 4 }),
        fc.jsonValue(),
        async (ruta, id, query, cuerpo) => {
          const qs = new URLSearchParams(query).toString();
          const path = rutaPublica(ruta, id) + (qs ? `?${qs}` : "");
          const bff = ruta.destino === "bffPos" ? bffPos : bffAuditoria;
          const antes = bff.recibidas.length;

          let peticion = pedir(app, ruta, path, token).set("X-Request-Id", "req-prop-3");
          if (ruta.metodo === "POST") peticion = peticion.set("Content-Type", "application/json").send(JSON.stringify(cuerpo));
          const res = await peticion;

          expect(res.status).toBe(200);
          expect(bff.recibidas.length).toBe(antes + 1);
          const recibida = bff.recibidas[bff.recibidas.length - 1];
          const rutaInternaEsperada = ruta.rutaInterna({ id }) + (qs ? `?${qs}` : "");

          expect(recibida.metodo).toBe(ruta.metodo);
          expect(recibida.ruta).toBe(rutaInternaEsperada);
          expect(recibida.cabeceras.authorization).toBeUndefined();
          expect(recibida.cabeceras["x-client-id"]).toBe("tienda-042");
          expect(recibida.cabeceras["x-request-id"]).toBe("req-prop-3");
          // El cuerpo viaja byte a byte (el Gateway no lo parsea). Se comparan
          // los textos: JSON no distingue -0 de 0, asi que parsear seria enganoso.
          if (ruta.metodo === "POST") expect(recibida.cuerpo).toBe(JSON.stringify(cuerpo));
          expect(res.body.ruta).toBe(rutaInternaEsperada); // el cuerpo del BFF llega sin cambios
          expect(res.headers["api-version"]).toBe("v1");
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: api-gateway, Property 4: El límite de tasa es por cliente e independiente entre clientes
  it("Property 4: el limite de tasa es por cliente e independiente entre clientes", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 6 }), async (limite) => {
        const { app } = crearAppPrueba({ jwksUri: jwks.jwksUri, bffPosUrl: bffPos.url, bffAuditoriaUrl: bffAuditoria.url, rateLimitMax: limite });
        const tokenA = `Bearer ${firmarToken({ scope: SCOPES.LEER_EVALUACIONES, azp: "cliente-A" })}`;
        const tokenB = `Bearer ${firmarToken({ scope: SCOPES.LEER_EVALUACIONES, azp: "cliente-B" })}`;
        const path = `/v1/evaluaciones-credito/${UUID}`;

        for (let i = 0; i < limite; i++) {
          const ok = await request(app).get(path).set("Authorization", tokenA);
          expect(ok.status).toBe(200);
          expect(ok.headers["ratelimit-limit"]).toBe(String(limite));
        }
        const excedida = await request(app).get(path).set("Authorization", tokenA);
        expect(excedida.status).toBe(429);
        expect(excedida.body.error).toMatchObject({ code: "LIMITE_TASA_EXCEDIDO", reintentable: true });
        expect(Number(excedida.headers["retry-after"])).toBeGreaterThan(0);

        const otroCliente = await request(app).get(path).set("Authorization", tokenB);
        expect(otroCliente.status).toBe(200);
      }),
      { numRuns: 25 }
    );
  });

  // Feature: api-gateway, Property 5: Rutas no versionadas o desconocidas responden 404 sin token ni proxy
  it("Property 5: rutas no versionadas o desconocidas responden 404 sin token ni proxy", async () => {
    const app = appBase();
    const arbDesconocida = fc.oneof(
      fc.constantFrom(...TABLA_RUTAS).map((r) => ({ metodo: r.metodo, path: rutaPublica(r).replace(/^\/v1/, "") })), // sin version
      fc.constantFrom(...TABLA_RUTAS).map((r) => ({ metodo: r.metodo, path: rutaPublica(r).replace(/^\/v1/, "/v2") })), // version no soportada
      fc.constantFrom(...TABLA_RUTAS).map((r) => ({ metodo: r.metodo, path: `${rutaPublica(r)}/extra` })), // segmento extra
      fc.constantFrom(...TABLA_RUTAS).map((r) => ({ metodo: r.metodo === "GET" ? "DELETE" : "PUT", path: rutaPublica(r) })), // metodo no permitido
      fc.stringMatching(/^\/[a-z0-9/-]{0,30}$/).filter((p) => p !== "/health").map((path) => ({ metodo: "GET", path }))
    );

    await fc.assert(
      fc.asyncProperty(arbDesconocida, async ({ metodo, path }) => {
        const antes = invocaciones();
        const res = await request(app)[metodo.toLowerCase()](path);

        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe("RUTA_NO_ENCONTRADA");
        expect(invocaciones()).toBe(antes);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: api-gateway, Property 6: Cada petición queda medida con una ruta de baja cardinalidad
  it("Property 6: cada peticion queda medida con una ruta de baja cardinalidad", async () => {
    const tipos = ["ok", "sin_token", "sin_scope", "no_encontrada"];

    await fc.assert(
      fc.asyncProperty(fc.array(fc.tuple(fc.constantFrom(...tipos), fc.uuid()), { minLength: 1, maxLength: 12 }), async (secuencia) => {
        const { app, registroMetricas } = crearAppPrueba({ jwksUri: jwks.jwksUri, bffPosUrl: bffPos.url, bffAuditoriaUrl: bffAuditoria.url });
        const lector = `Bearer ${firmarToken({ scope: SCOPES.LEER_EVALUACIONES })}`;
        const sinScope = `Bearer ${firmarToken({ scope: "" })}`;

        for (const [tipo, id] of secuencia) {
          const path = tipo === "no_encontrada" ? `/v1/desconocida/${id}` : `/v1/evaluaciones-credito/${id}?x=${id}`;
          const r = request(app).get(path);
          if (tipo === "ok") await r.set("Authorization", lector);
          else if (tipo === "sin_scope") await r.set("Authorization", sinScope);
          else await r;
        }

        // La metrica se registra en el evento 'finish' del servidor, que puede
        // ejecutarse despues de que Supertest (mismo event loop) ya recibio la
        // respuesta. Se espera a que se registren todas, con un limite de 1 s.
        const totalRegistrado = async () => (await registroMetricas.peticiones.get()).values.reduce((s, v) => s + v.value, 0);
        for (let espera = 0; espera < 100 && (await totalRegistrado()) < secuencia.length; espera++) {
          await new Promise((r) => setTimeout(r, 10));
        }

        const contador = await registroMetricas.peticiones.get();
        const total = contador.values.reduce((s, v) => s + v.value, 0);
        expect(total).toBe(secuencia.length);

        const histograma = await registroMetricas.duracion.get();
        const conteos = histograma.values.filter((v) => v.metricName === "gateway_http_request_duration_seconds_count");
        expect(conteos.reduce((s, v) => s + v.value, 0)).toBe(secuencia.length);

        for (const v of contador.values) {
          expect(["/v1/evaluaciones-credito/:id", "no_encontrada"]).toContain(v.labels.ruta);
          expect(v.labels.ruta).not.toMatch(/[0-9a-f]{8}-|\?/);
        }
      }),
      { numRuns: 50 }
    );
  });

  // Feature: api-gateway, Property 7: Todo fallo del BFF se traduce sin filtraciones
  it("Property 7: todo fallo del BFF se traduce sin filtraciones", async () => {
    const lento = await levantarBffEco({ demoraMs: 300 });
    const token = `Bearer ${firmarToken({ scope: TODOS_LOS_SCOPES.join(" ") })}`;

    try {
      await fc.assert(
        fc.asyncProperty(fc.constantFrom(...TABLA_RUTAS), fc.constantFrom("caido", "lento"), async (ruta, falla) => {
          const destino = falla === "caido" ? "http://localhost:1" : lento.url;
          const { app } = crearAppPrueba({
            jwksUri: jwks.jwksUri,
            bffPosUrl: destino,
            bffAuditoriaUrl: destino,
            bffPosTimeoutMs: 100,
            bffAuditoriaTimeoutMs: 100
          });

          const res = await pedir(app, ruta, rutaPublica(ruta), token);

          expect(res.status).toBe(falla === "caido" ? 502 : 504);
          expect(res.body).toEqual({
            error: {
              code: falla === "caido" ? "BFF_NO_DISPONIBLE" : "BFF_TIMEOUT",
              message: expect.any(String),
              reintentable: true
            }
          });
          expect(JSON.stringify(res.body)).not.toMatch(/localhost|ECONN|socket|127\.0\.0\.1|:\d{2,5}/);
        }),
        { numRuns: 20 }
      );
    } finally {
      await lento.cerrar();
    }
  });
});
