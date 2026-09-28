import mongoose from 'mongoose';

const clienteHistorialSchema = new mongoose.Schema({
  identificacion: { type: String, required: true, unique: true, index: true },
  tieneMoraVigente: { type: Boolean, default: false },
  creditosPrevios: { type: Number, default: 0 },
  ingresosDeclarados: { type: Number, default: null },
  fechaPrimerRegistro: { type: Date, default: Date.now },
  antiguedadMeses: { type: Number, default: 0 }
}, { timestamps: true });

export const ClienteHistorialModel = mongoose.model('ClienteHistorial', clienteHistorialSchema, 'clientes_historial');
export default ClienteHistorialModel;
