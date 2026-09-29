import mongoose from 'mongoose';

const auditoriaSchema = new mongoose.Schema({
  idEvaluacion: { type: String, required: true, unique: true, index: true },
  identificacion: { type: String, required: true, index: true },
  decision: { type: String, required: true },
  motivo: { type: String },
  fecha: { type: Date, default: Date.now, index: true },
  tiendaId: { type: String, default: 'TIENDA-001' },
  consultaBuroRealizada: { type: Boolean, default: false },
  scoreBuro: { type: Number, default: null },
  reglasAplicadas: { type: Array, default: [] }
}, { timestamps: true });

auditoriaSchema.index({ fecha: -1, decision: 1 });

export const AuditoriaModel = mongoose.model('Auditoria', auditoriaSchema, 'auditorias');
export default AuditoriaModel;
