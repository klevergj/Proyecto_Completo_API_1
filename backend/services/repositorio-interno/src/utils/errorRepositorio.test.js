const fc = require("fast-check");
const { ErrorRepositorio, clasificarErrorBaseDatos, clienteNoEncontrado } = require("./errorRepositorio");

const MARCA = "SECRETO-";
const CODIGOS_RED = ["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "ECONNRESET", "EAI_AGAIN"];
const SQLSTATE_NO_DISPONIBLE = ["57P01", "57P02", "57P03", "53300", "57014", "08006", "08001"];
const FRASES_NO_DISPONIBLE = ["timeout exceeded when trying to connect", "Query read timeout", "Connection terminated unexpectedly"];

function esperado503(code, frase) {
  return (
    CODIGOS_RED.includes(code) ||
    (typeof code === "string" && (code.startsWith("08") || ["57P01", "57P02", "57P03", "53300", "57014"].includes(code))) ||
    frase !== null
  );
}

describe("clasificarErrorBaseDatos", () => {
  // Feature: repositorio-interno, Property 7: Todo fallo de la base se traduce a un error estructurado y sin filtraciones
  it("Property 7: todo fallo de la base se traduce a un error estructurado y sin filtraciones", () => {
    const arbCode = fc.oneof(
      fc.constantFrom(...CODIGOS_RED, ...SQLSTATE_NO_DISPONIBLE),
      fc.stringMatching(/^[0-9A-Z]{5}$/),
      fc.constant(undefined)
    );
    const arbFrase = fc.option(fc.constantFrom(...FRASES_NO_DISPONIBLE), { nil: null });

    fc.assert(
      fc.property(arbCode, arbFrase, fc.string(), (code, frase, resto) => {
        const error = new Error(
          `${MARCA}${frase || ""} SELECT * FROM clientes_historial host=10.0.0.5 ${resto}`
        );
        if (code !== undefined) error.code = code;

        const clasificado = clasificarErrorBaseDatos(error);
        const respuesta = clasificado.toRespuesta();

        expect(clasificado).toBeInstanceOf(ErrorRepositorio);
        expect(Object.keys(respuesta)).toEqual(["error"]);
        expect(Object.keys(respuesta.error).sort()).toEqual(["code", "message"]);
        expect(["REPOSITORIO_NO_DISPONIBLE", "ERROR_INTERNO"]).toContain(respuesta.error.code);
        expect(clasificado.status).toBe(esperado503(code, frase) ? 503 : 500);
        expect(clasificado.code).toBe(clasificado.status === 503 ? "REPOSITORIO_NO_DISPONIBLE" : "ERROR_INTERNO");
        const serializado = JSON.stringify(respuesta);
        expect(serializado).not.toContain(MARCA);
        expect(serializado).not.toMatch(/clientes_historial|10\.0\.0\.5|SELECT/);
      }),
      { numRuns: 100 }
    );
  });

  it("un ErrorRepositorio se devuelve sin cambios", () => {
    const original = clienteNoEncontrado();
    expect(clasificarErrorBaseDatos(original)).toBe(original);
  });

  it("el 404 no incluye la identificacion", () => {
    expect(clienteNoEncontrado().toRespuesta()).toEqual({
      error: { code: "CLIENTE_NO_ENCONTRADO", message: "El cliente no tiene historial interno" }
    });
  });
});
