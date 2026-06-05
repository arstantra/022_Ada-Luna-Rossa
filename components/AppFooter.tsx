import React from 'react';
import { ND_LOGO_B64, AP_LOGO_B64 } from '../logos';

interface AppFooterProps {
  disciplina?: string;
}

const Sep: React.FC = () => (
  <span className="text-gray-700 select-none" aria-hidden="true">·</span>
);

const AppFooter: React.FC<AppFooterProps> = ({ disciplina }) => {
  return (
    <footer
      className="w-full flex items-center justify-between px-6 py-2.5 text-xs relative"
      style={{
        background: 'linear-gradient(90deg, #0D1117 0%, #0f0a1e 50%, #0D1117 100%)',
      }}
    >
      {/* Bordo superiore gradient viola-pink */}
      <span
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.22), rgba(236,72,153,0.12), transparent)' }}
        aria-hidden="true"
      />

      {/* Sinistra: ND logo | AP logo */}
      <div className="flex items-center gap-3 flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity">
        <a
          href="https://nuovadidattica.eu"
          target="_blank"
          rel="noopener noreferrer"
          title="NuovaDidattica.eu"
        >
          <img
            src={`data:image/png;base64,${ND_LOGO_B64}`}
            alt="NuovaDidattica.eu"
            className="h-5 w-auto"
          />
        </a>
        <span className="w-px h-4 bg-gray-700/60" aria-hidden="true" />
        <a
          href="https://nuovadidattica.eu"
          target="_blank"
          rel="noopener noreferrer"
          title="Andrea Poletti"
        >
          <img
            src={`data:image/png;base64,${AP_LOGO_B64}`}
            alt="Andrea Poletti"
            className="h-5 w-auto brightness-75 hover:brightness-100 transition-all"
          />
        </a>
      </div>

      {/* Destra: info su riga singola, stile NuovaDidattica */}
      <div className="flex items-center gap-2.5 font-mono text-[10px] text-gray-500">
        <span className="text-gray-400">NuovaDidattica.eu</span>
        <span className="text-gray-600">—</span>
        <span>Didattica Digitale &amp; AI</span>
        {disciplina && (
          <>
            <Sep />
            <span className="uppercase tracking-widest text-gray-400">{disciplina}</span>
          </>
        )}
        <Sep />
        <span>
          Un progetto di{' '}
          <a
            href="https://nuovadidattica.eu"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-gray-400 hover:text-gray-200 transition-colors"
          >
            AP
          </a>
        </span>
        <Sep />
        <span>Tutti i diritti riservati</span>
      </div>
    </footer>
  );
};

export default AppFooter;
