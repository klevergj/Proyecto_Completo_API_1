const { asegurarHistorialRepository } = require("./historialRepository.interface");
const { crearPostgresHistorialRepository } = require("./postgresHistorialRepository");
const { crearApp } = require("../app");

describe("HistorialRepository (interfaz)", () => {
  it("la implementacion PostgreSQL cumple la interfaz", () => {
    expect(() => crearPostgresHistorialRepository({ pool: { query: jest.fn() } })).not.toThrow();
  });

  it.each([
    ["null", null],
    ["objeto vacio", {}],
    ["metodo que no es funcion", { buscarPorIdentificacion: "no" }]
  ])("rechaza una implementacion invalida (%s)", (_caso, implementacion) => {
    expect(() => asegurarHistorialRepository(implementacion)).toThrow(TypeError);
  });

  it("crearApp rechaza un repositorio que no cumple la interfaz", () => {
    expect(() => crearApp({ historialRepository: {}, verificarConexion: async () => true })).toThrow(
      'HistorialRepository invalido: falta el metodo "buscarPorIdentificacion"'
    );
  });
});
