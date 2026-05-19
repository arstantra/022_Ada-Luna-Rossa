import React from 'react';
import { ND_LOGO_B64 } from '../logos';

interface AppFooterProps {
  disciplina?: string;
}

/* Stellina SVG — simbolo di Ada (identica all'header) */
const AdaStar: React.FC<{ size?: number }> = ({ size = 11 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
    style={{ flexShrink: 0 }}
  >
    <path
      d="M8 0 C8 0 8.6 5.4 9.4 6.6 C10.6 7.4 16 8 16 8 C16 8 10.6 8.6 9.4 9.4 C8.6 10.6 8 16 8 16 C8 16 7.4 10.6 6.6 9.4 C5.4 8.6 0 8 0 8 C0 8 5.4 7.4 6.6 6.6 C7.4 5.4 8 0 8 0 Z"
      fill="url(#ada-star-grad-f)"
    />
    <defs>
      <linearGradient id="ada-star-grad-f" x1="0" y1="0" x2="16" y2="16" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#c084fc" />
        <stop offset="100%" stopColor="#818cf8" />
      </linearGradient>
    </defs>
  </svg>
);

const AppFooter: React.FC<AppFooterProps> = ({ disciplina }) => {
  return (
    <footer
      className="w-full flex items-center justify-between px-6 py-2.5 text-xs relative"
      style={{
        background: 'linear-gradient(90deg, #0D1117 0%, #0f0a1e 50%, #0D1117 100%)',
      }}
    >
      {/* Bordo superiore gradient */}
      <span
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.22), rgba(236,72,153,0.12), transparent)' }}
        aria-hidden="true"
      />

      {/* Sinistra: ✦ Ada — brand compatto */}
      <a
        href="https://nuovadidattica.eu"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity flex-shrink-0"
        title="NuovaDidattica.eu"
      >
        <AdaStar size={11} />
        <span
          className="font-display text-[11px] font-semibold tracking-tight"
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

      {/* Destra: info contestuali leggibili */}
      <div className="flex items-center gap-2.5 font-mono text-[10px] text-gray-500">
        {disciplina && (
          <>
            <span className="uppercase tracking-widest text-gray-400">{disciplina}</span>
            <span className="text-gray-700" aria-hidden="true">·</span>
          </>
        )}
        <span className="text-gray-500">Sviluppato da Andrea Poletti</span>
        <span className="text-gray-700" aria-hidden="true">·</span>
        <a
          href="https://nuovadidattica.eu"
          target="_blank"
          rel="noopener noreferrer"
          className="uppercase tracking-wider text-gray-500 hover:text-gray-300 transition-colors"
        >
          NuovaDidattica.eu
        </a>
      </div>
    </footer>
  );
};

export default AppFooter;
