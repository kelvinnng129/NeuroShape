// components/ApiKeySettings.tsx
'use client';

import { useState } from 'react';

interface Props {
  onSave: (provider: string, key: string, model: string) => void;
  dark: boolean;
}

const PROVIDERS = [
  { id: 'openai',    name: 'OpenAI',    models: ['gpt-4o', 'gpt-4o-mini'] },
  { id: 'anthropic', name: 'Anthropic', models: ['claude-sonnet-4-20250514', 'claude-haiku-4-20250414'] },
];

export default function ApiKeySettings({ onSave, dark }: Props) {
  const [provider, setProvider] = useState('openai');
  const [key, setKey] = useState('');
  const [model, setModel] = useState('gpt-4o-mini');

  const currentProvider = PROVIDERS.find(p => p.id === provider)!;

  return (
    <div className={`p-4 rounded-lg border ${dark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
      <h3 className="text-sm font-semibold mb-3">🔑 AI 3D Generation (Your API Key)</h3>

      <select
        value={provider}
        onChange={(e) => {
          setProvider(e.target.value);
          setModel(PROVIDERS.find(p => p.id === e.target.value)!.models[0]);
        }}
        className={`w-full mb-2 p-2 rounded text-sm ${dark ? 'bg-gray-800' : 'bg-gray-100'}`}
      >
        {PROVIDERS.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

      <select
        value={model}
        onChange={(e) => setModel(e.target.value)}
        className={`w-full mb-2 p-2 rounded text-sm ${dark ? 'bg-gray-800' : 'bg-gray-100'}`}
      >
        {currentProvider.models.map(m => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>

      <input
        type="password"
        placeholder="sk-... or sk-ant-..."
        value={key}
        onChange={(e) => setKey(e.target.value)}
        className={`w-full mb-2 p-2 rounded text-sm ${dark ? 'bg-gray-800' : 'bg-gray-100'}`}
      />

      <p className={`text-[10px] mb-2 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
        Your key is used client-side only. Never stored or sent to our servers.
      </p>

      <button
        onClick={() => onSave(provider, key, model)}
        disabled={!key.trim()}
        className="w-full py-2 rounded bg-emerald-600 text-white text-sm 
                   hover:bg-emerald-500 disabled:opacity-30"
      >
        Save & Enable AI 3D
      </button>
    </div>
  );
}