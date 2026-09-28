import mongoose from 'mongoose';

const buroCreditoSchema = new mongoose.Schema({
  identificacion: { type: String, required: true, unique: true, index: true },
  score: { type: Number, required: true },
  tieneMoraBuro: { type: Boolean, default: false },
  reportadoEnMora: { type: Boolean, default: false },
  consultadoEn: { type: Date, default: Date.now }
}, { timestamps: true });

export const BuroCreditoModel = mongoose.model('BuroCredito', buroCreditoSchema, 'buro_credito');
export default BuroCreditoModel;
