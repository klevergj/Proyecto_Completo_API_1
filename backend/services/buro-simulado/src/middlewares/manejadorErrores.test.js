// Prueba de ejemplo (Supertest) para el manejador de errores global del buro-simulado.
// Tarea 8.5 — Fuerza un error no controlado y verifica que la respuesta sea
// estructurada con un objeto `error` que contiene `message` y `code`.
// Requisitos: 7.1

const express = require("express");
const request = require("supertest");
const { manejadorErrores } = require("./manejadorErrores");
const { ErrorBuro } = require("../utils/errorBuro");

// Mini-app con el manejador REAL del servicio al final de la pila.
function crearAppDePrueba(error) {
  const app = express();
  app.get("/falla", (req, res, next) => next(error));
  app.use(manejadorErrores);
  return app;
}

describe("Manejador de errores global (error no controlado)", () => {
  beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => console.error.mockRestore());

  test("responde 500 con un objeto error que contiene message y code no vacios", async () => {
    const respuesta = await request(crearAppDePrueba(new Error("Fallo no controlado de prueba"))).get("/falla");

    expect(respuesta.status).toBe(500);
    expect(typeof respuesta.body.error.message).toBe("string");
    expect(respuesta.body.error.message.length).toBeGreaterThan(0);
    expect(respuesta.body.error.code).toBe("BURO_SIMULATOR_ERROR");
  });

  test("respeta err.status cuando el error lo define", async () => {
    const err = new Error("Solicitud invalida");
    err.status = 400;

    const respuesta = await request(crearAppDePrueba(err)).get("/falla");

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.message.length).toBeGreaterThan(0);
    expect(respuesta.body.error.code.length).toBeGreaterThan(0);
  });

  test("un ErrorBuro conserva su estado y su codigo", async () => {
    const respuesta = await request(crearAppDePrueba(new ErrorBuro(503, "SERVICE_UNAVAILABLE", "caido"))).get("/falla");

    expect(respuesta.status).toBe(503);
    expect(respuesta.body).toEqual({ error: { message: "caido", code: "SERVICE_UNAVAILABLE" } });
  });
});
