import React from 'react';
import { XIcon } from './Icons';

/** Chiave sessionStorage: l'avviso chiuso resta chiuso fino alla fine della sessione del browser. */
export const DEMO_BANNER_HIDDEN_KEY = 'ada-demo-banner-hidden';

interface DemoBannerProps {
  onClose: () => void;
}

/**
 * Avviso "versione dimostrativa": striscia sottile sotto l'header.
 * Chiudibile; quando è chiusa resta il badge DEMO nell'header (vedi AppHeader).
 */
const DemoBanner: React.FC<DemoBannerProps> = ({ onClose }) => (
  <div
    role="note"
    className="flex-shrink-0 flex items-center justify-center gap-3 px-4 h-7 border-b border-red-500/40 text-[11px] font-mono text-red-300/90"
    style={{ backgroundColor: '#1a0d10' }}
  >
    <span className="font-semibold tracking-[0.2em] text-red-400 flex-shrink-0">DEMO</span>
    <span className="truncate">
      Versione dimostrativa · usa solo dati inventati · ciò che chiedi ad Ada viene inviato a Google (Gemini)
    </span>
    <button
      type="button"
      onClick={onClose}
      aria-label="Nascondi l'avviso demo"
      title="Nascondi (resta il badge DEMO in alto)"
      className="flex-shrink-0 p-0.5 rounded text-red-400/60 hover:text-red-300 hover:bg-red-500/10 transition-colors"
    >
      <XIcon className="h-3 w-3" />
    </button>
  </div>
);

export default DemoBanner;
