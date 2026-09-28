import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { CreditForm } from './components/CreditForm';
import { ResultCard } from './components/ResultCard';
import { evaluarCredito } from './services/apiService';
import { AlertCircle, RefreshCw } from 'lucide-react';

export function App() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFormSubmit = async (formData) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const responseData = await evaluarCredito(formData);
      setResult(responseData);
    } catch (err) {
      setError(err.message || 'Ocurrió un error inesperado al procesar la evaluación.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar />

      <main className="flex-grow max-w-4xl w-full mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Banner principal */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Evaluador de Créditos Financieros
          </h1>
          <p className="text-slate-600 max-w-xl mx-auto text-sm sm:text-base">
            Ingrese la identificación y detalles del crédito para recibir una resolución en tiempo real calculada por el motor de reglas de riesgo.
          </p>
        </div>

        {/* Formulario */}
        <CreditForm onSubmit={handleFormSubmit} isLoading={loading} />

        {/* Mensaje de Error de Red o Servidor */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 flex items-start gap-4 text-rose-800 shadow-md">
            <AlertCircle className="w-6 h-6 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="flex-grow">
              <h4 className="font-bold text-base">Error en la Consulta</h4>
              <p className="text-sm mt-1 text-rose-700">{error}</p>
            </div>
          </div>
        )}

        {/* Resultado */}
        {result && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={handleReset}
                className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm hover:bg-slate-100 transition cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Nueva Consulta
              </button>
            </div>
            <ResultCard result={result} />
          </div>
        )}
      </main>

      <footer className="bg-slate-900 text-slate-400 py-6 border-t border-slate-800 text-center text-xs mt-12">
        <p>© 2026 Resuelve Financial Technologies Inc. Todos los derechos reservados. OpenAPI API REST Architecture.</p>
      </footer>
    </div>
  );
}

export default App;
