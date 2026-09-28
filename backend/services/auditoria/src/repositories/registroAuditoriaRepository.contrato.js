/**
 * Pruebas de contrato de RegistroAuditoriaRepository: la MISMA bateria se
 * ejecuta contra cada implementacion (memoria y MongoDB) para garantizar que
 * tienen la misma semantica.
 */
const RegistroAuditoria = require("../models/registroAuditoria");
const { asegurarRegistroAuditoriaRepository } = require("./registroAuditoriaRepository.interface");

const REGISTRADO_EN = new Date("2026-09-24T12:00:00.000Z");

function registro(id, fecha, extra = {}) {
  return new RegistroAuditoria({
    idEvaluacion: id,
    decision: "APROBADO",
    fecha,
    consultaBuroRealizada: false,
    reglasAplicadas: ["REGLA_MORA_VIGENTE", "REGLA_CAPACIDAD_PAGO"],
    registradoEn: REGISTRADO_EN,
    ...extra
  });
}

const ID = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/**
 * @param {string} nombre
 * @param {{ crear: () => Promise<Object>, limpiar?: () => Promise<void>, cerrar?: () => Promise<void> }} fabrica
 */
function ejecutarContratoRepositorio(nombre, fabrica) {
  describe(`Contrato de RegistroAuditoriaRepository: ${nombre}`, () => {
    let repo;

    beforeEach(async () => {
      if (fabrica.limpiar) await fabrica.limpiar();
      repo = await fabrica.crear();
      await repo.inicializar();
    });

    afterAll(async () => {
      if (fabrica.cerrar) await fabrica.cerrar();
    });

    it("cumple la interfaz", () => {
      expect(() => asegurarRegistroAuditoriaRepository(repo)).not.toThrow();
    });

    it("inicializar es idempotente", async () => {
      await expect(repo.inicializar()).resolves.not.toThrow();
    });

    it("guarda y recupera por id con todos los campos (opcionales en null)", async () => {
      await repo.guardar(registro(ID(1), "2026-09-05T10:00:00.000Z", { tiendaId: "TIENDA-001", scoreBuro: 720 }));
      const r = await repo.buscarPorId(ID(1));

      expect(r).toBeInstanceOf(RegistroAuditoria);
      expect(r.tiendaId).toBe("TIENDA-001");
      expect(r.scoreBuro).toBe(720);
      expect(r.identificacion).toBeNull();
      expect(r.fecha.toISOString()).toBe("2026-09-05T10:00:00.000Z");
      expect(r.registradoEn.toISOString()).toBe(REGISTRADO_EN.toISOString());
      expect([...r.reglasAplicadas]).toEqual(["REGLA_MORA_VIGENTE", "REGLA_CAPACIDAD_PAGO"]);
    });

    it("buscarPorId de un id inexistente devuelve null", async () => {
      expect(await repo.buscarPorId(ID(999))).toBeNull();
    });

    it("un idEvaluacion duplicado lanza 409 y conserva el original", async () => {
      await repo.guardar(registro(ID(2), "2026-09-05T10:00:00.000Z", { decision: "APROBADO" }));
      await expect(repo.guardar(registro(ID(2), "2026-09-06T10:00:00.000Z", { decision: "RECHAZADO" }))).rejects.toMatchObject({
        status: 409,
        code: "REGISTRO_DUPLICADO"
      });
      expect((await repo.buscarPorId(ID(2))).decision).toBe("APROBADO");
    });

    it("filtra por estado, tienda y rango de dias UTC inclusivo", async () => {
      await repo.guardar(registro(ID(10), "2026-09-01T00:00:00.000Z", { decision: "APROBADO", tiendaId: "T1" }));
      await repo.guardar(registro(ID(11), "2026-09-02T23:59:59.999Z", { decision: "RECHAZADO", tiendaId: "T1" }));
      await repo.guardar(registro(ID(12), "2026-09-03T00:00:00.000Z", { decision: "RECHAZADO", tiendaId: "T2" }));

      const rango = await repo.buscar({ filtros: { fechaDesde: "2026-09-01", fechaHasta: "2026-09-02" }, page: 0, size: 10 });
      expect(rango.total).toBe(2);

      const combinado = await repo.buscar({ filtros: { estado: "RECHAZADO", tiendaId: "T1" }, page: 0, size: 10 });
      expect(combinado.items.map((r) => r.idEvaluacion)).toEqual([ID(11)]);
    });

    it("ordena por fecha descendente e idEvaluacion ascendente, y pagina en base 0", async () => {
      await repo.guardar(registro(ID(22), "2026-09-05T10:00:00.000Z"));
      await repo.guardar(registro(ID(21), "2026-09-05T10:00:00.000Z"));
      await repo.guardar(registro(ID(20), "2026-09-04T10:00:00.000Z"));
      await repo.guardar(registro(ID(23), "2026-09-06T10:00:00.000Z"));

      const p0 = await repo.buscar({ filtros: {}, page: 0, size: 2 });
      const p1 = await repo.buscar({ filtros: {}, page: 1, size: 2 });
      const p2 = await repo.buscar({ filtros: {}, page: 2, size: 2 });

      expect(p0.total).toBe(4);
      expect(p0.items.map((r) => r.idEvaluacion)).toEqual([ID(23), ID(21)]);
      expect(p1.items.map((r) => r.idEvaluacion)).toEqual([ID(22), ID(20)]);
      expect(p2.items).toEqual([]);
      expect(p2.total).toBe(4);
    });
  });
}

module.exports = {
  ejecutarContratoRepositorio
};
