import React from 'react';
import { ND_LOGO_B64 } from '../logos';

interface AppFooterProps {
  disciplina?: string;
}

const AppFooter: React.FC<AppFooterProps> = ({ disciplina }) => {
  return (
    <footer
      className="w-full flex items-center justify-between px-6 py-3 text-xs relative"
      style={{
        background: 'linear-gradient(90deg, #0D1117 0%, #0f0a1e 50%, #0D1117 100%)',
      }}
    >
      {/* Bordo superiore gradient */}
      <span
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.25), rgba(236,72,153,0.15), transparent)' }}
        aria-hidden="true"
      />

      {/* Sinistra: logo ND + Ada */}
      <a
        href="https://nuovadidattica.eu"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity flex-shrink-0"
        title="NuovaDidattica.eu"
      >
        <img
          src={`data:image/png;base64,${ND_LOGO_B64}`}
          alt="NuovaDidattica.eu"
          className="h-5 w-auto"
        />
        <span className="text-gray-700">·</span>
        <span
          className="font-display font-700 text-xs"
          style={{
            fontFamily: 'Syne, system-ui',
            background: 'linear-gradient(135deg, #c084fc, #818cf8)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Ada
        </span>
      </a>

      {/* Destra: link meta */}
      <div className="flex items-center gap-3 text-gray-700 font-mono">
        {disciplina && (
          <>
            <span className="text-purple-900 uppercase tracking-widest">{disciplina}</span>
            <span>·</span>
          </>
        )}
        <span>Sviluppato da Andrea Poletti</span>
        <span>·</span>
        <a
          href="https://nuovadidattica.eu"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-gray-500 transition-colors uppercase tracking-wider"
        >
          NuovaDidattica.eu
        </a>
      </div>
    </footer>
  );
};

export default AppFooter;
