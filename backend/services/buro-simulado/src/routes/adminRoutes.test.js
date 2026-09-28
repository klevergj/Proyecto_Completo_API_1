/**
 * Pruebas basadas en propiedades (fast-check) para la administracion de
 * escenarios del buro-simulado.
 *
 * Cubre:
 *   - Property 7 (Tarea 2.3): Conmutacion valida gobierna estado y comportamiento
 *   - Property 8 (Tarea 2.4): Conmutacion invalida rechaza y preserva estado
 *
 * Se usa Supertest contra la app exportada en src/index.js. La app protege
 * app.listen con NODE_ENV !== "test", por lo que se fuerza el entorno de prueba.
 * LATENCIA_MS se reduce ANTES de importar la app/rutas, ya que config/buroConfig.js captura
 * ese valor una unica vez al cargar el modulo (evita ralentizar la suite en el
 * escenario LATENCIA_ALTA).
 */

process.env.NODE_ENV = "test";
// Reducir la latencia del escenario LATENCIA_ALTA antes de importar la app,
// porque config/buroConfig.js lee LATENCIA_MS al cargarse (valor congelado).
process.env.LATENCIA_MS = "10";

const request = require("supertest");
const fc = require("fast-check");

const app = require("../index");
// El escenario activo vive en el EscenarioRepository inyectado en la app.
// guardar() asigna de forma sincronica (antes de su primer await), por lo que
// puede usarse sin await dentro de las propiedades.
const { escenarioRepository } = require("../index");
const setEscenario = (escenario) => escenarioRepository.guardar(escenario);

const ESCENARIOS_VALIDOS = ["NORMAL", "LATENCIA_ALTA", "CAIDO"];

// EscenarioRepository mantiene estado en memoria compartido entre pruebas; se fija
// NORMAL antes de cada test (para no depender del estado dejado por otra suite)
// y se restaura a NORMAL despues de cada test para evitar contaminacion cruzada.
beforeEach(() => {
  setEscenario("NORMAL");
});

afterEach(() => {
  setEscenario("NORMAL");
});

/**
 * Genera una capitalizacion aleatoria (por caracter) de la cadena dada.
 * Ej.: "normal" -> "NoRmAl", "nOrMAL", etc.
 */
function mezclaCapitalizacion(base) {
  return fc
    .array(fc.boolean(), { minLength: base.length, maxLength: base.length })
    .map((flags) =>
      base
        .split("")
        .map((ch, i) => (flags[i] ? ch.toUpperCase() : ch.toLowerCase()))
        .join("")
    );
}

describe("adminRoutes - conmutacion de escenarios (property-based)", () => {
  // Feature: buro-simulado, Property 7: Conmutación válida gobierna estado y comportamiento
  // Validates: Requisitos 3.1, 4.3, 5.1, 5.2, 5.4
  test("Property 7: conmutacion valida gobierna estado y comportamiento", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Escenario valido en capitalizacion aleatoria.
        fc.constantFrom(...ESCENARIOS_VALIDOS).chain((esc) => mezclaCapitalizacion(esc)),
        // Identificacion no vacia para la consulta posterior de score.
        fc.string({ minLength: 1 }).filter((s) => s.trim() !== ""),
        async (escenarioEntrada, identificacion) => {
          const esperado = escenarioEntrada.toUpperCase();

          // POST /admin/escenario -> 200 con el escenario normalizado (mayusculas).
          const postResp = await request(app)
            .post("/admin/escenario")
            .send({ escenario: escenarioEntrada });

          expect(postResp.status).toBe(200);
          expect(postResp.body.escenario).toBe(esperado);

          // GET /admin/escenario refleja el valor recien establecido.
          const getResp = await request(app).get("/admin/escenario");
          expect(getResp.status).toBe(200);
          expect(getResp.body.escenario).toBe(esperado);

          // GET /score/:identificacion se comporta segun el escenario activo.
          const scoreResp = await request(app).get(
            `/score/${encodeURIComponent(identificacion)}`
          );

          if (esperado === "CAIDO") {
            expect(scoreResp.status).toBe(503);
          } else {
            // NORMAL y LATENCIA_ALTA responden 200 con score (LATENCIA_ALTA
            // tras el retraso reducido configurado en LATENCIA_MS).
            expect(scoreResp.status).toBe(200);
            expect(typeof scoreResp.body.score).toBe("number");
            expect(scoreResp.body.escenarioSimulado).toBe(esperado);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: buro-simulado, Property 8: Conmutación inválida rechaza y preserva estado
  // Validates: Requisitos 5.3
  test("Property 8: conmutacion invalida rechaza y preserva estado", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Body con un escenario invalido (cadena fuera del conjunto) o ausente.
        fc.oneof(
          // Cadena que, normalizada a mayusculas, no pertenece al conjunto valido.
          fc
            .string()
            .filter((s) => !ESCENARIOS_VALIDOS.includes(s.toUpperCase()))
            .map((escenario) => ({ escenario })),
          // Campo escenario ausente del body.
          fc.constant({})
        ),
        async (body) => {
          // Estado previo conocido (restaurado a NORMAL por afterEach del test
          // anterior, pero lo fijamos explicitamente para robustez).
          const previoResp = await request(app).get("/admin/escenario");
          const escenarioPrevio = previoResp.body.escenario;

          // POST /admin/escenario -> 400 con code INVALID_SCENARIO.
          const postResp = await request(app).post("/admin/escenario").send(body);

          expect(postResp.status).toBe(400);
          expect(postResp.body.error).toBeDefined();
          expect(postResp.body.error.code).toBe("INVALID_SCENARIO");

          // El escenario activo permanece igual al previo.
          const actualResp = await request(app).get("/admin/escenario");
          expect(actualResp.status).toBe(200);
          expect(actualResp.body.escenario).toBe(escenarioPrevio);
        }
      ),
      { numRuns: 100 }
    );
  });
});
