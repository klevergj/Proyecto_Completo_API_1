import mongoose from 'mongoose';

const auditoriaSchema = new mongoose.Schema({
  idEvaluacion: { type: String, required: true, unique: true, index: true },
  identificacion: { type: String, required: true },
  decision: { type: String, required: true },
  motivo: { type: String },
  fecha: { type: Date, default: Date.now },
  tiendaId: { type: String, default: 'TIENDA-001' },
  consultaBuroRealizada: { type: Boolean, default: false },
  scoreBuro: { type: Number, default: null },
  reglasAplicadas: { type: Array, default: [] }
}, { timestamps: true });

export const AuditoriaModel = mongoose.model('Auditoria', auditoriaSchema, 'auditorias');
export default AuditoriaModel;
