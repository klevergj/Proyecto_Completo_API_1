const fc = require("fast-check");
const { ErrorBff, MENSAJES, traducirErrorCore } = require("./errorBff");

const CODIGOS_VALIDOS = [
  "SOLICITUD_INVALIDA",
  "ID_EVALUACION_INVALIDO",
  "EVALUACION_NO_ENCONTRADA",
  "EVALUACION_TIMEOUT",
  "SERVICIO_NO_DISPONIBLE",
  "ERROR_EVALUACION",
  "ERROR_INTERNO"
];

const MARCA = "SECRETO-";

function errorAxios({ code, status, data, message }) {
  const error = new Error(message);
  if (code !== undefined) error.code = code;
  if (status !== undefined) {
    error.response = { status, data };
  } else {
    error.request = {};
  }
  return error;
}

function statusEsperado(code, status, operacion) {
  if (code === "ECONNABORTED" || code === "ETIMEDOUT") return 504;
  if (status === undefined) return 503;
  if (status === 400) return 400;
  if (status === 404 && operacion === "consultar") return 404;
  return 502;
}

describe("traducirErrorCore", () => {
  // Feature: bff-punto-venta, Property 8: Todo fallo del core se traduce a un error estructurado y sin filtraciones
  it("Property 8: todo fallo del core produce un ErrorRespuestaPos estructurado y sin filtraciones", () => {
    const arbError = fc.record({
      code: fc.option(
        fc.constantFrom("ECONNABORTED", "ETIMEDOUT", "ECONNREFUSED", "ENOTFOUND", "ECONNRESET", "EAI_AGAIN", "ERR_BAD_RESPONSE"),
        { nil: undefined }
      ),
      status: fc.option(fc.integer({ min: 400, max: 599 }), { nil: undefined }),
      data: fc.oneof(
        fc.string().map((s) => MARCA + s),
        fc.record({ error: fc.record({ message: fc.string().map((s) => MARCA + s), code: fc.string().map((s) => MARCA + s) }) }),
        fc.constant(undefined)
      ),
      message: fc.string().map((s) => MARCA + s),
      operacion: fc.constantFrom("crear", "consultar")
    });

    fc.assert(
      fc.property(arbError, ({ code, status, data, message, operacion }) => {
        const traducido = traducirErrorCore(errorAxios({ code, status, data, message }), { operacion });
        const respuesta = traducido.toRespuesta();

        expect(traducido).toBeInstanceOf(ErrorBff);
        expect(Object.keys(respuesta)).toEqual(["error"]);
        expect(Object.keys(respuesta.error).sort()).toEqual(["code", "message", "reintentable"]);
        expect(CODIGOS_VALIDOS).toContain(respuesta.error.code);
        expect(respuesta.error.message.length).toBeGreaterThan(0);
        expect(typeof respuesta.error.reintentable).toBe("boolean");
        expect(JSON.stringify(respuesta)).not.toContain(MARCA);
        expect(traducido.status).toBe(statusEsperado(code, status, operacion));
      }),
      { numRuns: 100 }
    );
  });

  describe("ejemplos por fila de la tabla", () => {
    it("timeout -> 504 EVALUACION_TIMEOUT reintentable", () => {
      const e = traducirErrorCore(errorAxios({ code: "ECONNABORTED", message: "timeout of 5000ms exceeded" }), { operacion: "crear" });
      expect(e.status).toBe(504);
      expect(e.toRespuesta()).toEqual({
        error: { code: "EVALUACION_TIMEOUT", message: MENSAJES.EVALUACION_TIMEOUT, reintentable: true }
      });
    });

    it("conexion rechazada -> 503 SERVICIO_NO_DISPONIBLE reintentable", () => {
      const e = traducirErrorCore(errorAxios({ code: "ECONNREFUSED", message: "connect ECONNREFUSED 172.18.0.5:8090" }), { operacion: "crear" });
      expect(e.status).toBe(503);
      expect(e.code).toBe("SERVICIO_NO_DISPONIBLE");
      expect(e.reintentable).toBe(true);
    });

    it("core 400 INVALID_IDENTIFICACION -> 400 con mensaje de identificacion", () => {
      const e = traducirErrorCore(
        errorAxios({ status: 400, data: { error: { code: "INVALID_IDENTIFICACION", message: "x" } } }),
        { operacion: "crear" }
      );
      expect(e.status).toBe(400);
      expect(e.code).toBe("SOLICITUD_INVALIDA");
      expect(e.message).toBe(MENSAJES.IDENTIFICACION_INVALIDA);
      expect(e.reintentable).toBe(false);
    });

    it("core 400 generico -> 400 con mensaje generico", () => {
      const e = traducirErrorCore(errorAxios({ status: 400, data: {} }), { operacion: "crear" });
      expect(e.message).toBe(MENSAJES.SOLICITUD_INVALIDA);
    });

    it("core 404 en consulta -> 404 EVALUACION_NO_ENCONTRADA", () => {
      const e = traducirErrorCore(errorAxios({ status: 404 }), { operacion: "consultar" });
      expect(e.status).toBe(404);
      expect(e.code).toBe("EVALUACION_NO_ENCONTRADA");
      expect(e.reintentable).toBe(false);
    });

    it("core 404 al crear -> 502 ERROR_EVALUACION", () => {
      const e = traducirErrorCore(errorAxios({ status: 404 }), { operacion: "crear" });
      expect(e.status).toBe(502);
    });

    it("core 500 -> 502 ERROR_EVALUACION reintentable", () => {
      const e = traducirErrorCore(errorAxios({ status: 500, data: { error: { message: "boom" } } }), { operacion: "crear" });
      expect(e.status).toBe(502);
      expect(e.code).toBe("ERROR_EVALUACION");
      expect(e.reintentable).toBe(true);
    });

    it("un ErrorBff se devuelve sin cambios", () => {
      const original = new ErrorBff(400, "SOLICITUD_INVALIDA", "x", false);
      expect(traducirErrorCore(original, { operacion: "crear" })).toBe(original);
    });

    it("error sin request ni response -> 500 ERROR_INTERNO", () => {
      const e = traducirErrorCore(new TypeError("fallo local"), { operacion: "crear" });
      expect(e.status).toBe(500);
      expect(e.code).toBe("ERROR_INTERNO");
    });
  });
});
