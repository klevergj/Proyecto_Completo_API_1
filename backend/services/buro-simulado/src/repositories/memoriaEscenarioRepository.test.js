// Feature: buro-simulado, Property 9: Inicialización total del escenario
//
// Property 9: Inicialización total del escenario.
// Validates: Requisitos 5.5, 5.6
//
// Para todo valor de ESCENARIO_INICIAL: si su normalización a mayúsculas
// pertenece al conjunto { NORMAL, LATENCIA_ALTA, CAIDO }, el escenario activo
// inicial es ese valor normalizado; en cualquier otro caso (cadena inválida o
// variable ausente) el escenario activo inicial es NORMAL.

const fc = require("fast-check");
const { crearMemoriaEscenarioRepository } = require("./memoriaEscenarioRepository");
const { asegurarEscenarioRepository } = require("./escenarioRepository.interface");

const ESCENARIOS_VALIDOS = ["NORMAL", "LATENCIA_ALTA", "CAIDO"];

describe("memoriaEscenarioRepository - inicialización total del escenario (Property 9)", () => {
  test("valores válidos en distintas capitalizaciones se normalizan a mayúsculas", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...ESCENARIOS_VALIDOS),
        // Vector de capitalización: por cada carácter decide mayúscula/minúscula.
        fc.array(fc.boolean(), { minLength: 0, maxLength: 20 }),
        async (escenarioCanonico, capsFlags) => {
          const mezclado = escenarioCanonico
            .split("")
            .map((ch, i) => (capsFlags[i] ? ch.toUpperCase() : ch.toLowerCase()))
            .join("");

          const repositorio = crearMemoriaEscenarioRepository({ escenarioInicial: mezclado });
          expect(await repositorio.obtener()).toBe(escenarioCanonico);
        }
      ),
      { numRuns: 100 }
    );
  });

  test("valores inválidos (fuera del conjunto) inicializan en NORMAL", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string().filter((s) => !ESCENARIOS_VALIDOS.includes(s.toUpperCase())),
        async (valorInvalido) => {
          const repositorio = crearMemoriaEscenarioRepository({ escenarioInicial: valorInvalido });
          expect(await repositorio.obtener()).toBe("NORMAL");
        }
      ),
      { numRuns: 100 }
    );
  });

  test("ESCENARIO_INICIAL ausente inicializa en NORMAL", async () => {
    expect(await crearMemoriaEscenarioRepository().obtener()).toBe("NORMAL");
    expect(await crearMemoriaEscenarioRepository({ escenarioInicial: undefined }).obtener()).toBe("NORMAL");
  });

  test("buroConfig toma ESCENARIO_INICIAL del entorno", () => {
    const envOriginal = { ...process.env };
    try {
      jest.resetModules();
      process.env.ESCENARIO_INICIAL = "caido";
      // eslint-disable-next-line global-require
      expect(require("../config/buroConfig").escenarioInicial).toBe("caido");
    } finally {
      process.env = envOriginal;
      jest.resetModules();
    }
  });
});

describe("EscenarioRepository (interfaz)", () => {
  test("la implementación en memoria cumple la interfaz", () => {
    expect(() => asegurarEscenarioRepository(crearMemoriaEscenarioRepository())).not.toThrow();
  });

  test.each([
    ["null", null],
    ["sin guardar", { obtener: async () => "NORMAL" }],
    ["sin obtener", { guardar: async () => {} }]
  ])("rechaza una implementación inválida (%s)", (_caso, implementacion) => {
    expect(() => asegurarEscenarioRepository(implementacion)).toThrow(TypeError);
  });
});
