import React from 'react';
import { ND_LOGO_B64 } from '../logos';

interface AppHeaderProps {
  disciplina?: string;
}

/*
 * Stelline Ada — versione solid (Heroicons v2 solid sparkles, 24px viewBox)
 * Usa fill="currentColor" per poter colorare via className/style
 */
const AdaSparkles: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={className}
  >
    <path d="M9 4.5a.75.75 0 0 1 .721.544l.813 2.846a3.75 3.75 0 0 0 2.576 2.576l2.846.813a.75.75 0 0 1 0 1.442l-2.846.813a3.75 3.75 0 0 0-2.576 2.576l-.813 2.846a.75.75 0 0 1-1.442 0l-.813-2.846a3.75 3.75 0 0 0-2.576-2.576l-2.846-.813a.75.75 0 0 1 0-1.442l2.846-.813A3.75 3.75 0 0 0 7.466 7.89l.813-2.846A.75.75 0 0 1 9 4.5ZM18 1.5a.75.75 0 0 1 .728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 0 1 0 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 0 1-1.456 0l-.258-1.036a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456l.259-1.035A.75.75 0 0 1 18 1.5ZM16.5 15a.75.75 0 0 1 .712.513l.394 1.183c.15.447.5.799.948.948l1.183.395a.75.75 0 0 1 0 1.422l-1.183.395c-.447.15-.799.5-.948.948l-.395 1.183a.75.75 0 0 1-1.422 0l-.395-1.183a1.5 1.5 0 0 0-.948-.948l-1.183-.395a.75.75 0 0 1 0-1.422l1.183-.395c.447-.15.799-.5.948-.948l.395-1.183A.75.75 0 0 1 16.5 15Z" />
  </svg>
);

const AppHeader: React.FC<AppHeaderProps> = ({ disciplina }) => {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 backdrop-blur-md"
      style={{
        background: 'linear-gradient(90deg, #0D1117 0%, #0f0a1e 50%, #0D1117 100%)',
        boxShadow: '0 1px 0 0 rgba(124,58,237,0.18), 0 1px 0 0 rgba(236,72,153,0.10)',
      }}
    >
      {/* Sinistra: ND logo + divisore + ✦ Ada · Disciplina */}
      <a
        href="https://nuovadidattica.eu"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2.5 opacity-90 hover:opacity-100 transition-opacity"
        title="Torna a NuovaDidattica.eu"
      >
        <img
          src={`data:image/png;base64,${ND_LOGO_B64}`}
          alt="NuovaDidattica.eu"
          className="h-6 w-auto opacity-80"
        />
        <span className="hidden sm:block w-px h-4 bg-gray-700/70" />
        <span className="hidden sm:flex items-center gap-1.5">
          <AdaSparkles className="w-4 h-4 text-purple-400" />
          <span
            className="font-display text-white text-sm font-semibold tracking-tight"
            style={{ fontFamily: 'Syne, system-ui' }}
          >
            Ada
          </span>
          {disciplina && (
            <>
              <span className="text-gray-600 text-xs select-none">·</span>
              <span className="text-xs font-mono tracking-widest uppercase text-gray-500">
                {disciplina}
              </span>
            </>
          )}
        </span>
      </a>

      {/* Destra: NuovaDidattica.eu — leggero ma leggibile */}
      <a
        href="https://nuovadidattica.eu"
        target="_blank"
        rel="noopener noreferrer"
        className="hidden sm:block text-[10px] font-mono tracking-widest uppercase text-gray-500 hover:text-gray-300 transition-colors"
      >
        nuovadidattica.eu
      </a>
    </header>
  );
};

export default AppHeader;
