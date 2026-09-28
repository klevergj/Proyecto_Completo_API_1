// Prueba de ejemplo (Supertest) para el endpoint GET /health del buro-simulado.
// Tarea 8.4 — Smoke test que verifica respuesta 200 y presencia de
// las propiedades status, service y timestamp.
// Requisitos: 6.1

// Forzar entorno de prueba antes de importar la app para evitar app.listen()
process.env.NODE_ENV = "test";

const request = require("supertest");
const app = require("./index");

describe("GET /health", () => {
  test("responde 200 y el body incluye status, service y timestamp", async () => {
    const respuesta = await request(app).get("/health");

    // Verificar codigo de estado
    expect(respuesta.status).toBe(200);

    // Verificar presencia de las propiedades esperadas
    expect(respuesta.body).toHaveProperty("status");
    expect(respuesta.body).toHaveProperty("service");
    expect(respuesta.body).toHaveProperty("timestamp");
  });
});
