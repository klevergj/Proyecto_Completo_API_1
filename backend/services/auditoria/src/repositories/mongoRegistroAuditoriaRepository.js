const RegistroAuditoria = require("../models/registroAuditoria");
const { asegurarRegistroAuditoriaRepository } = require("./registroAuditoriaRepository.interface");
const { registroDuplicado } = require("../utils/errorAuditoria");
const { inicioDiaUtc, inicioDiaSiguienteUtc } = require("../utils/fechas");

const COLECCION = "registros_auditoria";
const CODIGO_CLAVE_DUPLICADA = 11000;
const ORDEN = { fecha: -1, _id: 1 };

// Indices que cubren filtro + orden (Req 5.2). _id = idEvaluacion ya es unico.
const INDICES = [
  { key: { fecha: -1, _id: 1 }, name: "fecha_desc_id" },
  { key: { decision: 1, fecha: -1, _id: 1 }, name: "decision_fecha_desc_id" },
  { key: { tiendaId: 1, fecha: -1, _id: 1 }, name: "tienda_fecha_desc_id" }
];

function aDocumento(registro) {
  return {
    _id: registro.idEvaluacion,
    identificacion: registro.identificacion,
    montoSolicitado: registro.montoSolicitado,
    plazoMeses: registro.plazoMeses,
    tiendaId: registro.tiendaId,
    decision: registro.decision,
    motivo: registro.motivo,
    fecha: registro.fecha,
    consultaBuroRealizada: registro.consultaBuroRealizada,
    scoreBuro: registro.scoreBuro,
    reglasAplicadas: [...registro.reglasAplicadas],
    registradoEn: registro.registradoEn
  };
}

function aModelo(documento) {
  const { _id, ...resto } = documento;
  return new RegistroAuditoria({ idEvaluacion: _id, ...resto });
}

function construirFiltro(filtros = {}) {
  const filtro = {};
  if (filtros.estado) filtro.decision = filtros.estado;
  if (filtros.tiendaId) filtro.tiendaId = filtros.tiendaId;
  if (filtros.fechaDesde || filtros.fechaHasta) {
    filtro.fecha = {};
    if (filtros.fechaDesde) filtro.fecha.$gte = inicioDiaUtc(filtros.fechaDesde);
    if (filtros.fechaHasta) filtro.fecha.$lt = inicioDiaSiguienteUtc(filtros.fechaHasta);
  }
  return filtro;
}

/**
 * Implementacion MongoDB de RegistroAuditoriaRepository. Es el UNICO modulo
 * que conoce la coleccion y la forma del documento.
 *
 * @param {{ db: import("mongodb").Db, mongoTimeoutMs: number }} deps
 * @returns {import("./registroAuditoriaRepository.interface").RegistroAuditoriaRepository}
 */
function crearMongoRegistroAuditoriaRepository({ db, mongoTimeoutMs }) {
  const coleccion = db.collection(COLECCION);

  async function inicializar() {
    await coleccion.createIndexes(INDICES);
  }

  async function guardar(registro) {
    try {
      await coleccion.insertOne(aDocumento(registro), { maxTimeMS: mongoTimeoutMs });
    } catch (error) {
      if (error && error.code === CODIGO_CLAVE_DUPLICADA) {
        throw registroDuplicado();
      }
      throw error;
    }
  }

  async function buscarPorId(idEvaluacion) {
    const documento = await coleccion.findOne({ _id: idEvaluacion }, { maxTimeMS: mongoTimeoutMs });
    return documento ? aModelo(documento) : null;
  }

  async function buscar({ filtros, page, size }) {
    const filtro = construirFiltro(filtros);
    const [documentos, total] = await Promise.all([
      coleccion.find(filtro, { maxTimeMS: mongoTimeoutMs }).sort(ORDEN).skip(page * size).limit(size).toArray(),
      coleccion.countDocuments(filtro, { maxTimeMS: mongoTimeoutMs })
    ]);
    return { total, items: documentos.map(aModelo) };
  }

  return asegurarRegistroAuditoriaRepository({ inicializar, guardar, buscarPorId, buscar });
}

module.exports = {
  crearMongoRegistroAuditoriaRepository,
  COLECCION,
  INDICES
};
