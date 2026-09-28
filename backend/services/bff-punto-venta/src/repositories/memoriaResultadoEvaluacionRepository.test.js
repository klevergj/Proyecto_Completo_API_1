const ResultadoEvaluacion = require("../models/resultadoEvaluacion");
const { crearMemoriaResultadoEvaluacionRepository } = require("./memoriaResultadoEvaluacionRepository");
const { asegurarResultadoEvaluacionRepository } = require("./resultadoEvaluacionRepository.interface");
const { crearEvaluacionPosService } = require("../services/evaluacionPosService");

const resultado = (id) => new ResultadoEvaluacion({ idEvaluacion: id, decision: "APROBADO" });

describe("memoriaResultadoEvaluacionRepository", () => {
  it("una entrada vigente se devuelve hasta justo antes del TTL y desaparece al cumplirlo", async () => {
    let t = 1000;
    const repo = crearMemoriaResultadoEvaluacionRepository({ ttlMs: 500, maxEntradas: 10, ahora: () => t });
    await repo.guardar(resultado("a"));

    t = 1499;
    expect(await repo.buscarPorId("a")).toEqual(resultado("a"));

    t = 1500;
    expect(await repo.buscarPorId("a")).toBeNull();
    expect(repo.tamanio()).toBe(0);
  });

  it("descarta la entrada menos usada al superar la capacidad", async () => {
    const repo = crearMemoriaResultadoEvaluacionRepository({ ttlMs: 10000, maxEntradas: 2 });
    await repo.guardar(resultado("a"));
    await repo.guardar(resultado("b"));
    await repo.guardar(resultado("c"));

    expect(await repo.buscarPorId("a")).toBeNull();
    expect(await repo.buscarPorId("b")).not.toBeNull();
    expect(await repo.buscarPorId("c")).not.toBeNull();
  });

  it("una lectura renueva la posicion LRU", async () => {
    const repo = crearMemoriaResultadoEvaluacionRepository({ ttlMs: 10000, maxEntradas: 2 });
    await repo.guardar(resultado("a"));
    await repo.guardar(resultado("b"));
    await repo.buscarPorId("a");
    await repo.guardar(resultado("c"));

    expect(await repo.buscarPorId("a")).not.toBeNull();
    expect(await repo.buscarPorId("b")).toBeNull();
  });
});

describe("ResultadoEvaluacionRepository (interfaz)", () => {
  it("la implementacion en memoria cumple la interfaz", () => {
    expect(() => crearMemoriaResultadoEvaluacionRepository({ ttlMs: 1, maxEntradas: 1 })).not.toThrow();
  });

  it.each([
    ["null", null],
    ["sin buscarPorId", { guardar: async () => {} }],
    ["sin guardar", { buscarPorId: async () => null }]
  ])("rechaza una implementacion invalida (%s)", (_caso, implementacion) => {
    expect(() => asegurarResultadoEvaluacionRepository(implementacion)).toThrow(TypeError);
  });

  it("el servicio rechaza un repositorio que no cumple la interfaz", () => {
    expect(() => crearEvaluacionPosService({ coreClient: {}, resultadoRepository: {} })).toThrow(
      'ResultadoEvaluacionRepository invalido: falta el metodo "guardar"'
    );
  });
});
