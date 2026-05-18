import React from 'react';
import { ND_LOGO_B64 } from '../logos';

interface AppHeaderProps {
  disciplina?: string;
}

const AppHeader: React.FC<AppHeaderProps> = ({ disciplina }) => {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 backdrop-blur-md"
      style={{
        background: 'linear-gradient(90deg, #0D1117 0%, #0f0a1e 50%, #0D1117 100%)',
        borderBottom: '1px solid transparent',
        backgroundClip: 'padding-box',
        boxShadow: '0 1px 0 0 rgba(124,58,237,0.18), 0 1px 0 0 rgba(236,72,153,0.10)',
      }}
    >
      {/* Sinistra: logo ND + divisore + Ada */}
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
        {/* Divisore verticale */}
        <span className="hidden sm:block w-px h-5 bg-gray-700" />
        {/* Ada con dot colorato */}
        <span className="hidden sm:flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #c084fc, #ec4899)' }}
          />
          <span
            className="font-display font-700 text-white text-base tracking-tight"
            style={{ fontFamily: 'Syne, system-ui' }}
          >
            Ada
          </span>
        </span>
      </a>

      {/* Destra: disciplina configurabile o placeholder */}
      <div className="flex items-center gap-3">
        {disciplina ? (
          <span className="text-xs font-mono tracking-widest uppercase text-purple-400/80">
            {disciplina}
          </span>
        ) : (
          <span className="text-xs font-mono tracking-widest uppercase text-gray-700">
            Assistente Didattico
          </span>
        )}
        <span className="hidden sm:block text-xs font-mono text-gray-800">·</span>
        <span className="hidden sm:block text-xs font-mono tracking-wider text-gray-700 uppercase">
          nuovadidattica.eu
        </span>
      </div>
    </header>
  );
};

export default AppHeader;
