import React from 'react';
import { Landmark, Shield } from 'lucide-react';

export const Navbar = () => {
  return (
    <header className="bg-slate-900 text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Landmark className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="font-bold text-lg tracking-tight block leading-tight">
              <span className="text-blue-400 font-normal">Resuelve</span>
            </span>
            <span className="text-xs text-slate-400 hidden sm:block">
              Tienda Centro Sur · Caja 03
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700 text-xs text-slate-300">
          <Shield className="w-4 h-4 text-emerald-400" />
          <span className="font-medium">Evaluación Segura API v1</span>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
