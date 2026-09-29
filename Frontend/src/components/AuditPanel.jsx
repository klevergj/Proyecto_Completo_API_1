import React, { useState, useEffect } from 'react';
import { obtenerAuditorias } from '../services/apiService';

export const AuditPanel = () => {
  const [audits, setAudits] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [decisionFilter, setDecisionFilter] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  const fetchAudits = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 10 };
      if (decisionFilter) params.decision = decisionFilter;
      if (fechaDesde) params.fechaDesde = fechaDesde;
      if (fechaHasta) params.fechaHasta = fechaHasta;

      const response = await obtenerAuditorias(params);
      setAudits(response.data || response.items || []);
      setTotal(response.total || 0);
      setTotalPages(response.totalPages || 1);
    } catch (err) {
      setError(err.message || 'Error al obtener auditorías');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAudits();
  }, [page, decisionFilter, fechaDesde, fechaHasta]);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <h2 className="text-xl font-bold mb-4">Auditoría de Evaluaciones</h2>
      
      <div className="flex flex-wrap gap-4 mb-4">
        <select 
          className="border border-slate-300 rounded px-3 py-2"
          value={decisionFilter}
          onChange={(e) => { setDecisionFilter(e.target.value); setPage(1); }}
        >
          <option value="">Todas las decisiones</option>
          <option value="APROBADO">Aprobado</option>
          <option value="RECHAZADO">Rechazado</option>
          <option value="REVISION_MANUAL">Revisión Manual</option>
        </select>
        
        <input 
          type="date"
          className="border border-slate-300 rounded px-3 py-2"
          value={fechaDesde}
          onChange={(e) => { setFechaDesde(e.target.value); setPage(1); }}
          placeholder="Fecha Desde"
        />
        
        <input 
          type="date"
          className="border border-slate-300 rounded px-3 py-2"
          value={fechaHasta}
          onChange={(e) => { setFechaHasta(e.target.value); setPage(1); }}
          placeholder="Fecha Hasta"
        />
      </div>

      {error && <div className="text-red-500 mb-4">{error}</div>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-slate-500">
          <thead className="text-xs text-slate-700 uppercase bg-slate-50">
            <tr>
              <th className="px-4 py-3">ID Evaluación</th>
              <th className="px-4 py-3">Identificación</th>
              <th className="px-4 py-3">Decisión</th>
              <th className="px-4 py-3">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="4" className="text-center py-4">Cargando...</td></tr>
            ) : audits.length === 0 ? (
              <tr><td colSpan="4" className="text-center py-4">No se encontraron registros</td></tr>
            ) : (
              audits.map(audit => (
                <tr key={audit.idEvaluacion || audit._id} className="border-b">
                  <td className="px-4 py-3 font-medium">{audit.idEvaluacion}</td>
                  <td className="px-4 py-3">{audit.identificacion}</td>
                  <td className="px-4 py-3">{audit.decision}</td>
                  <td className="px-4 py-3">{new Date(audit.fecha).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center mt-4">
        <button 
          disabled={page <= 1}
          onClick={() => setPage(p => p - 1)}
          className="px-4 py-2 border rounded disabled:opacity-50"
        >
          Anterior
        </button>
        <span>Página {page} de {totalPages} (Total: {total})</span>
        <button 
          disabled={page >= totalPages}
          onClick={() => setPage(p => p + 1)}
          className="px-4 py-2 border rounded disabled:opacity-50"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
};

export default AuditPanel;
