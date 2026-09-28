import React from 'react';
import { CheckCircle2, AlertTriangle, Clock, Hash, Calendar, ShieldCheck, Database } from 'lucide-react';

export const ResultCard = ({ result }) => {
  if (!result) return null;

  // Soportar tanto decision (Core/Auditoria) como aprobado (ResultadoPos de BFF Punto de Venta)
  let decision = result.decision || result.estado;
  if (!decision && result.aprobado !== undefined) {
    if (result.aprobado === true) {
      decision = 'APROBADO';
    } else if (result.mensajeParaCliente && result.mensajeParaCliente.toLowerCase().includes('revisión')) {
      decision = 'REVISION_MANUAL';
    } else {
      decision = 'RECHAZADO';
    }
  }
  if (!decision) decision = 'REVISION_MANUAL';

  const idEvaluacion = result.idEvaluacion || result.solicitudId || 'N/A';
  const motivo = result.mensajeParaCliente || result.motivo || result.mensaje || 'Sin detalles adicionales.';
  const consultaBuro = result.consultaBuroRealizada !== undefined ? result.consultaBuroRealizada : true;
  const fechaFormatted = result.fecha ? new Date(result.fecha).toLocaleString() : new Date().toLocaleString();

  const isApproved = decision === 'APROBADO';
  const isRevision = decision === 'REVISION_MANUAL';
  const isRejected = decision === 'RECHAZADO';

  let cardBgClass = 'bg-amber-50/70 border-amber-200';
  let badgeBgClass = 'bg-amber-100 text-amber-900 border-amber-300';
  let iconBgClass = 'bg-amber-500';
  let IconComponent = Clock;
  let titleText = 'Evaluación en Revisión Manual';

  if (isApproved) {
    cardBgClass = 'bg-emerald-50/70 border-emerald-200';
    badgeBgClass = 'bg-emerald-100 text-emerald-900 border-emerald-300';
    iconBgClass = 'bg-emerald-500';
    IconComponent = CheckCircle2;
    titleText = '¡Crédito Aprobado!';
  } else if (isRejected) {
    cardBgClass = 'bg-rose-50/70 border-rose-200';
    badgeBgClass = 'bg-rose-100 text-rose-900 border-rose-300';
    iconBgClass = 'bg-rose-500';
    IconComponent = AlertTriangle;
    titleText = 'Solicitud No Aprobada';
  }

  return (
    <div className={`rounded-2xl shadow-xl border p-6 md:p-8 transition-all duration-300 ${cardBgClass}`}>
      {/* Encabezado y Badge */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-200/80">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl text-white shadow-md ${iconBgClass}`}>
            <IconComponent className="w-8 h-8" />
          </div>
          <div>
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-1 border ${badgeBgClass}`}>
              {decision}
            </span>
            <h3 className="text-xl font-bold text-slate-900">{titleText}</h3>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-white/80 px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
          <Hash className="w-4 h-4 text-slate-400" />
          <span>ID Evaluación: {idEvaluacion}</span>
        </div>
      </div>

      {/* Detalles del resultado */}
      <div className="mt-6 space-y-6">
        {/* Motivo de la API */}
        <div className="bg-white/80 p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Dictamen del Motor de Riesgo</h4>
          <p className="text-sm md:text-base text-slate-800 font-medium leading-relaxed">
            {motivo}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Consulta a buró externo */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Consulta a Buró Externo</p>
              <p className="text-sm font-bold text-slate-800">
                {consultaBuro ? 'Sí (Consultado)' : 'No (Resuelto Internamente)'}
              </p>
            </div>
          </div>

          {/* Origen de Verificación */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Historial Interno</p>
              <p className="text-sm font-bold text-slate-800">Verificado en Servidor</p>
            </div>
          </div>

          {/* Fecha y hora */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3 sm:col-span-2 lg:col-span-1">
            <div className="p-2.5 bg-slate-100 text-slate-600 rounded-lg">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Fecha de Evaluación</p>
              <p className="text-sm font-semibold text-slate-800">{fechaFormatted}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultCard;
