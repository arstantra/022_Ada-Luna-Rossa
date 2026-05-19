import React from 'react';
import { ND_LOGO_B64 } from '../logos';

interface AppHeaderProps {
  disciplina?: string;
}

/* Stellina SVG — simbolo di Ada */
const AdaStar: React.FC<{ size?: number }> = ({ size = 13 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
    style={{ flexShrink: 0, marginTop: 1 }}
  >
    <path
      d="M8 0 C8 0 8.6 5.4 9.4 6.6 C10.6 7.4 16 8 16 8 C16 8 10.6 8.6 9.4 9.4 C8.6 10.6 8 16 8 16 C8 16 7.4 10.6 6.6 9.4 C5.4 8.6 0 8 0 8 C0 8 5.4 7.4 6.6 6.6 C7.4 5.4 8 0 8 0 Z"
      fill="url(#ada-star-grad-h)"
    />
    <defs>
      <linearGradient id="ada-star-grad-h" x1="0" y1="0" x2="16" y2="16" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#c084fc" />
        <stop offset="100%" stopColor="#ec4899" />
      </linearGradient>
    </defs>
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
          <AdaStar size={13} />
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
