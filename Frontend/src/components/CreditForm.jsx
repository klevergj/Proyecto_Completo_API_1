import React, { useState } from 'react';
import { FileText, DollarSign, Calendar, Loader2, Send, AlertCircle, ShieldCheck } from 'lucide-react';

export const CreditForm = ({ onSubmit, isLoading }) => {
  const [formData, setFormData] = useState({
    identificacion: '',
    montoSolicitado: '',
    plazoMeses: '12'
  });

  const [errors, setErrors] = useState({});

  /**
   * Función centralizada de validación del formulario.
   */
  const validateField = (name, value) => {
    let errorMsg = '';

    if (name === 'identificacion') {
      const cleanVal = value.trim();
      if (!cleanVal) {
        errorMsg = 'La identificación (Cédula / DNI / RUC) es requerida.';
      } else if (cleanVal.length < 5 || cleanVal.length > 13) {
        errorMsg = 'La identificación debe contener entre 5 y 13 dígitos.';
      }
    }

    if (name === 'montoSolicitado') {
      const num = parseFloat(value);
      if (!value || isNaN(num) || num <= 0) {
        errorMsg = 'El monto solicitado debe ser mayor a $0 USD.';
      }
    }

    if (name === 'plazoMeses') {
      const num = parseInt(value, 10);
      if (!value || isNaN(num) || num <= 0) {
        errorMsg = 'El plazo debe ser mayor a 0 meses.';
      }
    }

    return errorMsg;
  };

  const validateAll = (data) => {
    const newErrors = {};

    ['identificacion', 'montoSolicitado', 'plazoMeses'].forEach((field) => {
      const err = validateField(field, data[field]);
      if (err) {
        newErrors[field] = err;
      }
    });

    return newErrors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    let sanitizedValue = value;

    if (name === 'identificacion') {
      // Permitir números y letras si es RUC/DNI, limando caracteres especiales
      sanitizedValue = value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 13);
    }

    const updatedFormData = {
      ...formData,
      [name]: sanitizedValue
    };

    setFormData(updatedFormData);

    const fieldError = validateField(name, sanitizedValue);
    setErrors((prev) => ({
      ...prev,
      [name]: fieldError
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const validationErrors = validateAll(formData);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).some((key) => validationErrors[key])) {
      return;
    }

    const payload = {
      identificacion: formData.identificacion.trim(),
      montoSolicitado: parseFloat(formData.montoSolicitado) || 0,
      plazoMeses: parseInt(formData.plazoMeses, 10) || 12,
      tiendaId: 'TIENDA-001'
    };

    onSubmit(payload);
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 md:p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-blue-600" />
            Evaluación Instantánea de Crédito
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Ingrese la identificación del cliente y el crédito deseado. Los datos financieros e historial crediticio son verificados automáticamente.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Identificación (Cédula / DNI / RUC) */}
          <div>
            <label htmlFor="identificacion" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Cédula / DNI / RUC <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <FileText className="w-5 h-5" />
              </div>
              <input
                type="text"
                id="identificacion"
                name="identificacion"
                maxLength={13}
                value={formData.identificacion}
                onChange={handleChange}
                placeholder="Ej. 0102030405"
                className={`w-full pl-10 pr-4 py-2.5 rounded-lg border outline-none transition ${
                  errors.identificacion
                    ? 'border-rose-500 text-rose-900 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-rose-50/30'
                    : 'border-slate-300 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                }`}
              />
            </div>
            {errors.identificacion && (
              <p className="mt-1.5 text-xs font-medium text-rose-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {errors.identificacion}
              </p>
            )}
          </div>

          {/* Monto Solicitado (USD) */}
          <div>
            <label htmlFor="montoSolicitado" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Monto Solicitado (USD) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <DollarSign className="w-5 h-5" />
              </div>
              <input
                type="number"
                id="montoSolicitado"
                name="montoSolicitado"
                step="0.01"
                min="0.01"
                value={formData.montoSolicitado}
                onChange={handleChange}
                placeholder="Ej. 1200.00"
                className={`w-full pl-10 pr-4 py-2.5 rounded-lg border outline-none transition ${
                  errors.montoSolicitado
                    ? 'border-rose-500 text-rose-900 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-rose-50/30'
                    : 'border-slate-300 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                }`}
              />
            </div>
            {errors.montoSolicitado && (
              <p className="mt-1.5 text-xs font-medium text-rose-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {errors.montoSolicitado}
              </p>
            )}
          </div>

          {/* Plazo (Meses) */}
          <div>
            <label htmlFor="plazoMeses" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Plazo (Meses) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Calendar className="w-5 h-5" />
              </div>
              <select
                id="plazoMeses"
                name="plazoMeses"
                value={formData.plazoMeses}
                onChange={handleChange}
                className={`w-full pl-10 pr-4 py-2.5 rounded-lg border outline-none transition bg-white ${
                  errors.plazoMeses
                    ? 'border-rose-500 text-rose-900 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-rose-50/30'
                    : 'border-slate-300 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                }`}
              >
                <option value="6">6 Meses</option>
                <option value="12">12 Meses</option>
                <option value="18">18 Meses</option>
                <option value="24">24 Meses</option>
                <option value="36">36 Meses</option>
                <option value="48">48 Meses</option>
              </select>
            </div>
            {errors.plazoMeses && (
              <p className="mt-1.5 text-xs font-medium text-rose-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {errors.plazoMeses}
              </p>
            )}
          </div>
        </div>

        <div className="pt-3">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer text-base"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Consultando motor de reglas y buró de crédito...</span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span>Solicitar Evaluación de Crédito</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreditForm;
