// Pruebas de latencia configurable (LATENCIA_MS) - Tareas 6.3, 6.4 y 6.5.
//
// CRITICO: LATENCIA_MS se lee UNA sola vez al cargar el modulo config/buroConfig.js. Por eso
// establecemos aqui un valor reducido (50 ms) y NODE_ENV="test" ANTES de importar
// la app/rutas. De lo contrario se aplicaria el retraso por defecto (5000 ms) y la
// suite seria demasiado lenta.
process.env.LATENCIA_MS = "50";
process.env.NODE_ENV = "test";

const request = require("supertest");
const fc = require("fast-check");
const app = require("../index");
// El escenario activo vive en el EscenarioRepository inyectado en la app.
// guardar() asigna de forma sincronica (antes de su primer await), por lo que
// puede usarse sin await dentro de las propiedades.
const { escenarioRepository } = require("../index");
const setEscenario = (escenario) => escenarioRepository.guardar(escenario);

// Valor reducido de latencia usado por el modulo config/buroConfig.js (debe coincidir con
// process.env.LATENCIA_MS establecido arriba).
const LATENCIA_MS = 50;

// Aislamiento del estado singleton compartido (EscenarioRepository): se fija NORMAL
// ANTES de cada prueba para no depender del escenario que pudiera haber dejado
// otra suite, y se restaura NORMAL DESPUES de cada prueba para no filtrarlo.
beforeEach(() => {
  setEscenario("NORMAL");
});

afterEach(() => {
  setEscenario("NORMAL");
});

describe("Latencia configurable (LATENCIA_MS) en escenario LATENCIA_ALTA", () => {
  // Feature: buro-simulado, Property 5: Igualdad de valores NORMAL vs LATENCIA_ALTA
  // Validates: Requisitos 1.6, 2.4, 3.3
  //
  // Tarea 6.3: con LATENCIA_MS reducido, el escenario LATENCIA_ALTA solo introduce
  // un retraso; los valores calculados (score, moraExterna, deudaExternaTotal) deben
  // ser identicos a los obtenidos bajo NORMAL para la misma identificacion.
  it("Property 5: score, moraExterna y deudaExternaTotal son identicos entre NORMAL y LATENCIA_ALTA", async () => {
    await fc.assert(
      // Se restringe el espacio de entrada a identificaciones NO vacias tras trim():
      // una cadena solo-espacios (p. ej. " ") satisface minLength:1 pero el endpoint
      // la rechaza con 400 (INVALID_IDENTIFICACION). Ese caso pertenece a la propiedad
      // de validacion (score.validacion.test.js), no a la equivalencia NORMAL vs
      // LATENCIA_ALTA. Sin este filtro la propiedad era intermitente (200 esperado /
      // 400 recibido) al generarse ocasionalmente una identificacion solo-espacios.
      fc.asyncProperty(fc.string({ minLength: 1 }).filter((s) => s.trim() !== ""), async (identificacion) => {
        const ruta = `/score/${encodeURIComponent(identificacion)}`;

        // Consulta bajo NORMAL.
        setEscenario("NORMAL");
        const normal = await request(app).get(ruta);
        expect(normal.status).toBe(200);

        // Consulta bajo LATENCIA_ALTA.
        setEscenario("LATENCIA_ALTA");
        const latencia = await request(app).get(ruta);
        expect(latencia.status).toBe(200);

        // Los valores calculados deben coincidir; solo cambia el retraso.
        expect(latencia.body.score).toBe(normal.body.score);
        expect(latencia.body.moraExterna).toBe(normal.body.moraExterna);
        expect(latencia.body.deudaExternaTotal).toBe(normal.body.deudaExternaTotal);
      }),
      { numRuns: 100 }
    );
  }, 30000);

  // Tarea 6.4: prueba de ejemplo (Supertest) para el umbral de latencia.
  // _Requisitos: 3.2, 3.3_
  //
  // Bajo LATENCIA_ALTA la respuesta NO debe emitirse antes del umbral configurado
  // (LATENCIA_MS) y finalmente debe responder 200.
  it("no emite la respuesta antes del umbral LATENCIA_MS bajo LATENCIA_ALTA y responde 200", async () => {
    setEscenario("LATENCIA_ALTA");

    const inicio = Date.now();
    const respuesta = await request(app).get("/score/cliente-latencia-123");
    const transcurrido = Date.now() - inicio;

    expect(respuesta.status).toBe(200);
    expect(transcurrido).toBeGreaterThanOrEqual(LATENCIA_MS);
  }, 10000);

  // Tarea 6.5: prueba de ejemplo (Supertest) para concurrencia bajo LATENCIA_ALTA.
  // _Requisitos: 3.4_
  //
  // N peticiones concurrentes deben resolver todas con 200, sin rechazos ni descartes.
  it("resuelve todas las peticiones concurrentes con 200 bajo LATENCIA_ALTA", async () => {
    setEscenario("LATENCIA_ALTA");

    const N = 20;
    const peticiones = Array.from({ length: N }, (_, i) =>
      request(app).get(`/score/cliente-concurrente-${i}`)
    );

    const respuestas = await Promise.all(peticiones);

    expect(respuestas).toHaveLength(N);
    respuestas.forEach((respuesta) => {
      expect(respuesta.status).toBe(200);
    });
  }, 10000);
});
