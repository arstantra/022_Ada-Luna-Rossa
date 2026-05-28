import React, { useState } from 'react';
import { useMasterContext } from './hooks/useMasterContext';
import { ProgettazioneCacheProvider } from './contexts/ProgettazioneCacheContext';
import MainApp from './components/MainApp';
import FoundingDocumentsView from './components/FoundingDocumentsView';
import ApiKeySetup from './components/ApiKeySetup';
import AppHeader from './components/AppHeader';
import AppFooter from './components/AppFooter';
import { SparklesIcon } from './components/Icons';
import { ADA_API_KEY_STORAGE } from './services/gemini';

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem(ADA_API_KEY_STORAGE) || '');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const masterContext = useMasterContext();

  const handleApiKeySet = (key: string) => {
    localStorage.setItem(ADA_API_KEY_STORAGE, key);
    setApiKey(key);
    setShowApiKeyModal(false);
  };

  // Primo step: inserimento chiave API
  if (!apiKey) {
    return <ApiKeySetup onApiKeySet={handleApiKeySet} />;
  }
  
  if (masterContext.isLoading) {
    return (
        <div className="flex items-center justify-center h-screen w-screen bg-gray-900 text-gray-100">
            <div className="text-center">
                <SparklesIcon className="mx-auto h-12 w-12 text-purple-400 animate-pulse" />
                <h1 className="mt-4 text-xl font-bold text-white">Caricamento Laboratorio...</h1>
                <p className="mt-2 text-sm text-gray-400">Verifica del database in corso...</p>
            </div>
        </div>
    );
  }

  if (masterContext.isUninitialized) {
    return (
      <div className="flex h-screen w-screen bg-gray-900 text-gray-100 font-sans">
        <FoundingDocumentsView masterContext={masterContext} onClose={() => {}} isInitialSetup />
      </div>
    );
  }


  return (
    <ProgettazioneCacheProvider progettazioneText={masterContext.progettazione}>
      {showApiKeyModal && (
        <ApiKeySetup
          isModal
          onApiKeySet={handleApiKeySet}
          onClose={() => setShowApiKeyModal(false)}
        />
      )}
      <div className="flex flex-col h-screen w-screen">
        <AppHeader disciplina={masterContext.disciplina} />
        <div className="flex-1 overflow-hidden pt-14">
          <MainApp masterContext={masterContext} onOpenApiSettings={() => setShowApiKeyModal(true)} />
        </div>
        <AppFooter disciplina={masterContext.disciplina} />
      </div>
    </ProgettazioneCacheProvider>
  );
};

export default App;