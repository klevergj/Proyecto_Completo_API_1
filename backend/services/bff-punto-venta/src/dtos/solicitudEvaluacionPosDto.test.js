const { validarSolicitudEvaluacionPos } = require("./solicitudEvaluacionPosDto");

const valida = { identificacion: "1720000002", montoSolicitado: 450, plazoMeses: 12, tiendaId: "TIENDA-001" };

describe("validarSolicitudEvaluacionPos", () => {
  it("acepta una solicitud valida y devuelve la SolicitudCore", () => {
    expect(validarSolicitudEvaluacionPos(valida)).toEqual({ ok: true, valor: valida });
  });

  it.each([
    ["identificacion vacia", { identificacion: "   " }, "La identificación es obligatoria"],
    ["identificacion numerica", { identificacion: 1720000002 }, "La identificación es obligatoria"],
    ["monto string", { montoSolicitado: "450" }, "El monto solicitado debe ser un número mayor que cero"],
    ["monto cero", { montoSolicitado: 0 }, "El monto solicitado debe ser un número mayor que cero"],
    ["monto infinito", { montoSolicitado: Infinity }, "El monto solicitado debe ser un número mayor que cero"],
    ["plazo decimal", { plazoMeses: 12.5 }, "El plazo en meses debe ser un número entero mayor que cero"],
    ["plazo negativo", { plazoMeses: -6 }, "El plazo en meses debe ser un número entero mayor que cero"],
    ["tienda ausente", { tiendaId: undefined }, "El identificador de tienda es obligatorio"]
  ])("rechaza %s", (_caso, cambio, mensaje) => {
    expect(validarSolicitudEvaluacionPos({ ...valida, ...cambio })).toEqual({ ok: false, errores: [mensaje] });
  });

  it("acumula todos los errores", () => {
    const resultado = validarSolicitudEvaluacionPos({});
    expect(resultado.ok).toBe(false);
    expect(resultado.errores).toHaveLength(4);
  });

  it.each([null, [], "texto", 42])("rechaza un cuerpo que no es objeto (%p)", (body) => {
    expect(validarSolicitudEvaluacionPos(body)).toEqual({
      ok: false,
      errores: ["El cuerpo de la solicitud debe ser un objeto JSON"]
    });
  });
});
