import React, { useState, useEffect } from 'react';
import { useMasterContext } from './hooks/useMasterContext';
import { ConstitutionCacheProvider } from './contexts/ConstitutionCacheContext';
import MainApp from './components/MainApp';
import LoginView from './components/LoginView';
import FoundingDocumentsView from './components/FoundingDocumentsView';
import ApiKeySetup from './components/ApiKeySetup';
import { APP_CONFIG } from './config';
import { SparklesIcon } from './components/Icons';
import { ADA_API_KEY_STORAGE } from './services/gemini';

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem(ADA_API_KEY_STORAGE) || '');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const masterContext = useMasterContext();

  useEffect(() => {
      // Allow access without password in development if password is not robust
      if (APP_CONFIG.PASSWORD === 'INSERISCI_UNA_PASSWORD_ROBUSTA_QUI') {
          setIsAuthenticated(true);
      }
  }, []);

  const handleApiKeySet = (key: string) => {
    localStorage.setItem(ADA_API_KEY_STORAGE, key);
    setApiKey(key);
    setShowApiKeyModal(false);
  };

  const handleLogin = (password: string): boolean => {
    if (password === APP_CONFIG.PASSWORD) {
        // Use component state for authentication, avoiding sessionStorage
        setIsAuthenticated(true);
        return true;
    }
    return false;
  };

  // Primo step: inserimento chiave API
  if (!apiKey) {
    return <ApiKeySetup onApiKeySet={handleApiKeySet} />;
  }

  if (!isAuthenticated) {
    return <LoginView onLogin={handleLogin} />;
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
    <ConstitutionCacheProvider constitutionText={masterContext.constitution}>
      {showApiKeyModal && (
        <ApiKeySetup
          isModal
          onApiKeySet={handleApiKeySet}
          onClose={() => setShowApiKeyModal(false)}
        />
      )}
      <MainApp masterContext={masterContext} onOpenApiSettings={() => setShowApiKeyModal(true)} />
    </ConstitutionCacheProvider>
  );
};

export default App;