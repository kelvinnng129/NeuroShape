'use client';

import { KeyRound } from 'lucide-react';
import { useNS } from './context';

export default function ApiKeyModal() {
  const {
    showApiKeyModal, setShowApiKeyModal,
    customApiKey, setCustomApiKey,
    customApiProvider, setCustomApiProvider,
    quotaWarning, uploadedFile,
  } = useNS();

  if (!showApiKeyModal) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowApiKeyModal(false)} />
      <div className="relative bg-white border border-gray-200 rounded-2xl p-6 w-[420px] max-w-[90vw] shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-green-500" />
            <h3 className="text-lg font-semibold text-gray-900">API Key</h3>
          </div>
          <button onClick={() => setShowApiKeyModal(false)} className="text-gray-400 hover:text-gray-600 transition">✕</button>
        </div>

        <p className="text-gray-500 text-sm mb-3">NeuroShape uses GPT-4o for best results. Enter your own API key for full-quality detection.</p>
        <p className="text-blue-500 text-xs mb-5 leading-relaxed">💡 No API key? No problem — CLIP-based detection still works.</p>

        <label className="block text-xs font-bold text-gray-600 mb-1.5 tracking-wider">PROVIDER</label>
        <div className="flex gap-2 mb-4">
          {[{ id: 'poe', label: 'Poe', hint: 'poe.com/api' }, { id: 'openai', label: 'OpenAI', hint: 'platform.openai.com' }].map(p => (
            <button key={p.id} onClick={() => { setCustomApiProvider(p.id); localStorage.setItem('neuroshape_api_provider', p.id); }}
              className={`flex-1 py-2.5 px-3 rounded-xl border text-sm font-medium transition-all ${customApiProvider === p.id ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'}`}>
              <div>{p.label}</div><div className="text-[10px] opacity-60 mt-0.5">{p.hint}</div>
            </button>
          ))}
        </div>

        <label className="block text-xs font-bold text-gray-600 mb-1.5 tracking-wider">API KEY</label>
        <input type="password" placeholder={customApiProvider === 'poe' ? 'Paste your Poe API key...' : 'sk-...'}
          value={customApiKey} onChange={e => setCustomApiKey(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/30 mb-2" />

        <a href={customApiProvider === 'poe' ? 'https://poe.com/api_key' : 'https://platform.openai.com/api-keys'}
          target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1 mb-4">
          ↗ Get a {customApiProvider === 'poe' ? 'Poe' : 'OpenAI'} API key
        </a>

        {customApiKey && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 mb-3">
            <span className="text-green-600 text-sm">✓ Key set — using <b>{customApiProvider === 'poe' ? 'Poe' : 'OpenAI'}</b></span>
          </div>
        )}

        <div className="text-gray-400 text-xs bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 mb-5">
          🔒 Your key is sent directly per-request and never stored on any server.
        </div>

        <div className="flex gap-3">
          {customApiKey && (
            <button onClick={() => { setCustomApiKey(''); setShowApiKeyModal(false); }}
              className="flex-1 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm hover:bg-red-50 transition">Remove Key</button>
          )}
          <button onClick={() => { setShowApiKeyModal(false); localStorage.setItem('neuroshape_api_provider', customApiProvider); }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition ${customApiKey && quotaWarning ? 'bg-green-500 text-white hover:bg-green-400' : 'bg-gray-900 text-white hover:bg-gray-800'}`}>
            {customApiKey && quotaWarning ? 'Save & Retry' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
}