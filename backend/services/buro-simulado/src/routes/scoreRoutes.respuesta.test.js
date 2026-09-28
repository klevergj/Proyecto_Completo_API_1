// Pruebas de respuesta del endpoint GET /score/:identificacion - Tareas 8.1, 8.2 y 8.3.
//
// CRITICO: config/buroConfig.js lee LATENCIA_MS UNA sola vez al cargar el modulo. Por eso
// establecemos aqui un valor reducido (10 ms) y NODE_ENV="test" ANTES de importar
// la app/rutas. De lo contrario se aplicaria el retraso por defecto (5000 ms).
process.env.NODE_ENV = "test";
process.env.LATENCIA_MS = "10";

const request = require("supertest");
const fc = require("fast-check");
const app = require("../index");
// El escenario activo vive en el EscenarioRepository inyectado en la app.
// guardar() asigna de forma sincronica (antes de su primer await), por lo que
// puede usarse sin await dentro de las propiedades.
const { escenarioRepository } = require("../index");
const setEscenario = (escenario) => escenarioRepository.guardar(escenario);

// Regex de fecha-hora ISO 8601 (formato que produce Date.prototype.toISOString()).
const REGEX_ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

// Aislamiento del estado singleton compartido (EscenarioRepository): se fija NORMAL
// ANTES de cada prueba para no depender del escenario dejado por otra suite y
// se restaura NORMAL DESPUES de cada prueba para no filtrarlo.
beforeEach(() => {
  setEscenario("NORMAL");
});

afterEach(() => {
  setEscenario("NORMAL");
});

describe("GET /score/:identificacion - respuesta segun escenario", () => {
  // Feature: buro-simulado, Property 4: Completitud y tipos de la respuesta NORMAL
  // Validates: Requisitos 1.1
  //
  // Tarea 8.1: bajo escenario NORMAL, cualquier identificacion no vacia produce 200
  // con todos los campos presentes y con los tipos correctos.
  it("Property 4: la respuesta NORMAL incluye todos los campos con los tipos correctos", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1 }).filter((s) => s.trim() !== ""), async (identificacion) => {
        setEscenario("NORMAL");

        const respuesta = await request(app).get(`/score/${encodeURIComponent(identificacion)}`);

        expect(respuesta.status).toBe(200);

        // identificacion: igual al recibido tras decodificar.
        expect(respuesta.body.identificacion).toBe(identificacion);

        // score: entero.
        expect(Number.isInteger(respuesta.body.score)).toBe(true);

        // moraExterna: booleano.
        expect(typeof respuesta.body.moraExterna).toBe("boolean");

        // deudaExternaTotal: numero.
        expect(typeof respuesta.body.deudaExternaTotal).toBe("number");

        // fechaConsulta: string con formato ISO 8601 valido.
        expect(typeof respuesta.body.fechaConsulta).toBe("string");
        expect(REGEX_ISO_8601.test(respuesta.body.fechaConsulta)).toBe(true);
        expect(Number.isNaN(Date.parse(respuesta.body.fechaConsulta))).toBe(false);

        // escenarioSimulado: string.
        expect(typeof respuesta.body.escenarioSimulado).toBe("string");
      }),
      { numRuns: 100 }
    );
  }, 30000);

  // Feature: buro-simulado, Property 6: Respuesta bajo CAIDO (503 + error, sin campos de score)
  // Validates: Requisitos 1.7, 4.2
  //
  // Tarea 8.2: con el escenario activo CAIDO, cualquier identificacion produce 503
  // con un objeto error (message y code no vacios) y sin campos de score.
  it("Property 6: la respuesta bajo CAIDO es 503 con error y sin campos de score", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1 }).filter((s) => s.trim() !== ""), async (identificacion) => {
        setEscenario("CAIDO");

        const respuesta = await request(app).get(`/score/${encodeURIComponent(identificacion)}`);

        expect(respuesta.status).toBe(503);

        // error.message y error.code: strings no vacios.
        expect(respuesta.body).toHaveProperty("error");
        expect(typeof respuesta.body.error.message).toBe("string");
        expect(respuesta.body.error.message.length).toBeGreaterThan(0);
        expect(typeof respuesta.body.error.code).toBe("string");
        expect(respuesta.body.error.code.length).toBeGreaterThan(0);

        // Ausencia de los campos de score.
        expect(respuesta.body).not.toHaveProperty("score");
        expect(respuesta.body).not.toHaveProperty("moraExterna");
        expect(respuesta.body).not.toHaveProperty("deudaExternaTotal");
      }),
      { numRuns: 100 }
    );
  }, 30000);

  // Tarea 8.3: prueba de ejemplo (Supertest) para CAIDO rapido sin retraso.
  // _Requisitos: 4.1_
  //
  // El escenario CAIDO debe responder 503 sin aplicar el retraso de latencia; la
  // respuesta debe emitirse en menos de 1 s.
  it("responde 503 bajo CAIDO sin aplicar el retraso de latencia (< 1000 ms)", async () => {
    setEscenario("CAIDO");

    const inicio = Date.now();
    const respuesta = await request(app).get("/score/cliente-caido-123");
    const transcurrido = Date.now() - inicio;

    expect(respuesta.status).toBe(503);
    expect(transcurrido).toBeLessThan(1000);
  }, 10000);
});
