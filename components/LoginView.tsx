import React, { useState, FormEvent } from 'react';
import { SparklesIcon } from './Icons';

interface LoginViewProps {
  onLogin: (password: string) => boolean;
}

const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const success = onLogin(password);
    if (!success) {
      setPassword('');
      setError('Password non corretta. Riprova.');
    }
  };

  return (
    <div className="flex items-center justify-center h-screen w-screen bg-gray-900 text-gray-100 font-sans">
      <div className="w-full max-w-sm p-8 space-y-6 bg-gray-800 rounded-xl shadow-lg border border-gray-700/50 animate-fade-in-up">
        <div className="text-center">
          <SparklesIcon className="mx-auto h-12 w-12 text-purple-400" />
          <h1 className="mt-4 text-2xl font-bold text-white">Accesso Riservato</h1>
          <p className="mt-2 text-sm text-gray-400">Inserisci la password per continuare</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="password-input" className="sr-only">Password</label>
            <input
              id="password-input"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Password"
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-red-400 text-center">{error}</p>}
          <div>
            <button
              type="submit"
              className="w-full px-4 py-3 font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition-colors"
            >
              Entra
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginView;
