// Prueba de ejemplo (Supertest) - Tarea 5.2
// Valida la respuesta 400 cuando la identificacion queda vacia tras trim().
// _Requisitos: 2.5_

// Establecer entorno de prueba ANTES de importar la app para evitar app.listen().
process.env.NODE_ENV = "test";

const request = require("supertest");
const app = require("../index");

describe("GET /score/:identificacion - validacion de identificacion vacia (Req. 2.5)", () => {
  test("responde 400 con error INVALID_IDENTIFICACION cuando la identificacion es solo espacios", async () => {
    // Una ruta vacia (GET /score/) no matchea, por lo que se envia un espacio
    // codificado (%20) que tras trim() queda vacio.
    const respuesta = await request(app).get("/score/%20");

    expect(respuesta.status).toBe(400);
    expect(respuesta.body).toHaveProperty("error");
    expect(typeof respuesta.body.error.message).toBe("string");
    expect(respuesta.body.error.message.length).toBeGreaterThan(0);
    expect(respuesta.body.error.code).toBe("INVALID_IDENTIFICACION");
  });
});
