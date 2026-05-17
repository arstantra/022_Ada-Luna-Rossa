import React from 'react';
import { ND_LOGO_B64 } from '../logos';

const AppHeader: React.FC = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 bg-gray-950/80 backdrop-blur-md border-b border-gray-800/60">
      <a
        href="https://nuovadidattica.eu"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 opacity-90 hover:opacity-100 transition-opacity"
        title="Torna a NuovaDidattica.eu"
      >
        <img
          src={`data:image/png;base64,${ND_LOGO_B64}`}
          alt="NuovaDidattica.eu"
          className="h-8 w-auto"
        />
        <span className="text-xs text-gray-400 hidden sm:block">nuovadidattica.eu</span>
      </a>
      <div className="text-xs text-gray-600 tracking-widest uppercase font-mono">
        Ada · Laboratorio di Design
      </div>
    </header>
  );
};

export default AppHeader;
