import React from 'react';
import { AP_LOGO_B64 } from '../logos';

const AppFooter: React.FC = () => {
  return (
    <footer className="w-full flex items-center justify-center gap-4 px-6 py-3 bg-gray-950/60 border-t border-gray-800/40 text-xs text-gray-600">
      <a
        href="https://nuovadidattica.eu"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:opacity-80 transition-opacity flex-shrink-0"
      >
        <img
          src={`data:image/png;base64,${AP_LOGO_B64}`}
          alt="Andrea Poletti"
          className="h-6 w-auto opacity-50 hover:opacity-80 transition-opacity"
        />
      </a>
      <span className="text-gray-700">·</span>
      <span>ADA — Laboratorio di Design · Sviluppato da Andrea Poletti · <a href="https://nuovadidattica.eu" target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 transition-colors">NuovaDidattica.eu</a></span>
    </footer>
  );
};

export default AppFooter;
