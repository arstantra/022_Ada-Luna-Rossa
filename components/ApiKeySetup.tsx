import React, { useState, FormEvent } from 'react';
import { SparklesIcon } from './Icons';

interface ApiKeySetupProps {
  onApiKeySet: (key: string) => void;
  isModal?: boolean;
  onClose?: () => void;
}

const ApiKeySetup: React.FC<ApiKeySetupProps> = ({ onApiKeySet, isModal = false, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmed = apiKey.trim();
    if (!trimmed) {
      setError('Inserisci una chiave API valida.');
      return;
    }
    if (!trimmed.startsWith('AIza')) {
      setError('La chiave API Gemini dovrebbe iniziare con "AIza". Controlla e riprova.');
      return;
    }
    setIsLoading(true);
    // Breve pausa per feedback visivo
    await new Promise(r => setTimeout(r, 400));
    setIsLoading(false);
    onApiKeySet(trimmed);
  };

  const content = (
    <div className={isModal ? '' : 'w-full max-w-lg p-8 space-y-6 bg-gray-800 rounded-xl shadow-lg border border-gray-700/50 animate-fade-in-up'}>
      <div className="text-center">
        <SparklesIcon className="mx-auto h-12 w-12 text-purple-400" />
        <h1 className="mt-4 text-2xl font-bold text-white">
          {isModal ? 'Aggiorna Chiave API' : 'Benvenuto in Ada'}
        </h1>
        <p className="mt-2 text-sm text-gray-400">
          {isModal
            ? 'Inserisci la nuova chiave API Gemini per aggiornare le impostazioni.'
            : 'Per iniziare, inserisci la tua chiave API Google Gemini. È gratuita e resta sul tuo browser.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="api-key-input" className="block text-sm font-medium text-gray-300 mb-2">
            Chiave API Gemini
          </label>
          <input
            id="api-key-input"
            type="password"
            autoComplete="off"
            required
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
            placeholder="AIzaSy..."
            autoFocus
          />
        </div>

        {error && <p className="text-sm text-red-400 text-center">{error}</p>}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full px-4 py-3 font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-purple-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Salvataggio...' : isModal ? 'Aggiorna Chiave' : 'Inizia a usare Ada →'}
        </button>
      </form>

      <div className="border-t border-gray-700 pt-5 space-y-3">
        <p className="text-xs text-gray-500 text-center font-semibold uppercase tracking-wide">Come ottenere la chiave gratuita</p>
        <ol className="text-xs text-gray-400 space-y-2 list-decimal list-inside">
          <li>Vai su <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 underline">aistudio.google.com/apikey</a></li>
          <li>Accedi con il tuo account Google</li>
          <li>Clicca su <span className="text-white font-medium">"Create API Key"</span></li>
          <li>Copia la chiave e incollala qui sopra</li>
        </ol>
        <p className="text-xs text-gray-600 text-center pt-1">
          La chiave viene salvata solo nel tuo browser e non viene mai inviata a server terzi.
        </p>
      </div>

      {isModal && onClose && (
        <button
          type="button"
          onClick={onClose}
          className="w-full px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          Annulla
        </button>
      )}
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="w-full max-w-lg bg-gray-800 rounded-xl shadow-lg border border-gray-700/50 p-8 space-y-6 animate-fade-in-up">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-screen w-screen bg-gray-900 text-gray-100 font-sans p-4">
      {content}
    </div>
  );
};

export default ApiKeySetup;
