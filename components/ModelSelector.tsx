import React, {useState} from 'react';
import { ModelConfig, ModelProvider } from '../types';
import { useLocalization } from '../hooks/useLocalization';

interface ModelSelectorProps {
  config: ModelConfig;
  onChange: (newConfig: ModelConfig) => void;
  onFetchModels: () => void;
  disabled: boolean;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ config, onChange, onFetchModels, disabled }) => {
  const [isFetching, setIsFetching] = useState(false);
  const { t } = useLocalization();

  const handleProviderChange = (provider: ModelProvider) => {
    onChange({ ...config, provider });
  };
  
  const handleOllamaChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    onChange({ 
      ...config, 
      ollama: {
        ...config.ollama,
        [e.target.name]: e.target.value
      }
    });
  };

  const handleGeminiChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({
      ...config,
      gemini: {
        ...config.gemini,
        [e.target.name]: e.target.value
      }
    });
  };

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const handleSaveApiKey = async () => {
    const apiKey = config.gemini.apiKey || '';
    if (!apiKey) {
      setSaveMessage('Please enter an API key before saving.');
      return;
    }
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch('/api/save-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey })
      });
      const data = await res.json();
      if (res.ok) {
        setSaveMessage('API key saved. Please restart the dev server to apply changes.');
      } else {
        setSaveMessage(data.message || 'Failed to save API key.');
      }
    } catch (err) {
      setSaveMessage('Failed to save API key. Check your connection.');
    } finally {
      setSaving(false);
    }
  };

  const handleFetchClick = async () => {
    setIsFetching(true);
    // For compatibility, keep fetch available but the default Apply Model action
    // should simply apply the typed model name. We still call onFetchModels
    // when the developer intended to fetch the available models (not used here).
    await onFetchModels();
    setIsFetching(false);
  }

  const handleApplyClick = () => {
    // The input already updates config.ollama.model via handleOllamaChange.
    // Calling onChange with the same config ensures parent receives the most
    // recent value and can act on it (e.g., persist or validate).
    onChange({ ...config });
  }

  return (
  <div className="w-full mx-auto bg-gray-950 p-6 rounded-lg">
      <h2 className="text-lg font-bold text-center mb-4 text-white">{t('modelSelectorTitle')}</h2>
      <fieldset className="space-y-4" disabled={disabled}>
        <legend className="sr-only">AI Provider</legend>
        {/* removed static PROMPTFOR label per user request */}
        <div className="flex justify-center gap-4">
          {(['gemini', 'ollama'] as ModelProvider[]).map((provider) => (
            <div key={provider}>
              <input
                type="radio"
                id={provider}
                name="provider"
                value={provider}
                checked={config.provider === provider}
                onChange={() => handleProviderChange(provider)}
                className="sr-only"
              />
              <label
                htmlFor={provider}
                className={`
                  px-6 py-2 rounded-md font-semibold cursor-pointer transition-all duration-200
                  ${config.provider === provider ? 'bg-white text-black shadow-lg' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}
                  ${disabled ? 'cursor-not-allowed opacity-50' : ''}
                `}
              >
                {t(`${provider}Provider`)}
              </label>
            </div>
          ))}
        </div>

        <div className="pt-4 text-sm text-gray-500">
          {config.provider === 'gemini' && (
            <div className="space-y-4 text-left">
              <div>
                  <label htmlFor="gemini-model" className="block text-sm font-medium text-gray-400 mb-1">{t('modelNameLabel')}</label>
                  <select
                    id="gemini-model"
                    name="model"
                    value={config.gemini.model}
                    onChange={handleGeminiChange}
                    className="w-full bg-gray-900 border border-gray-700 text-white rounded-md shadow-sm focus:ring-white focus:border-white p-2.5 transition-colors font-mono"
                  >
                    <option value="gemini-2.5-flash">{t('geminiModelRecommended')}</option>
                  </select>
                  <p className="mt-2 text-xs text-gray-500">{t('geminiModelHint')}</p>
               </div>
                {/* Image Generation Credits box removed per user request */}
               <div className="!mt-6 space-y-4">
                  <div>
                    <label htmlFor="gemini-api-key" className="block text-sm font-medium text-gray-400 mb-1">{t('apiKeyLabel')}</label>
                    <input
                      id="gemini-api-key"
                      type="password"
                      name="apiKey"
                      value={config.gemini.apiKey || ''}
                      onChange={handleGeminiChange}
                      placeholder={t('apiKeyPlaceholder')}
                      className="w-full bg-gray-900 border border-gray-700 text-white rounded-md shadow-sm focus:ring-white focus:border-white p-2.5 transition-colors font-mono"
                    />
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleSaveApiKey}
                      disabled={saving}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save API Key'}
                    </button>
                    {saveMessage && (
                      <span className="text-sm text-yellow-300">{saveMessage}</span>
                    )}
                  </div>
                  
                  <div className="p-4 bg-black/20 border border-gray-800 rounded-md text-gray-400">
                    <h3 className="font-semibold text-gray-300">{t('apiKeyInstructionsTitle')}</h3>
                    <ol className="mt-2 list-decimal list-inside space-y-2">
                      <li>{t('apiKeyStep1')}</li>
                      <li>{t('apiKeyStep2')}</li>
                      <li>{t('apiKeyStep3')}</li>
                      <li>{t('apiKeyStep4')}</li>
                    </ol>
                    <a 
                      href="https://aistudio.google.com/api-keys" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="inline-block mt-3 text-sm text-white underline hover:text-gray-300"
                    >
                      Visit Google AI Studio →
                    </a>
                  </div>
                </div>
            </div>
          )}
          {config.provider === 'ollama' && (
             <div className="space-y-4 text-left">
               <div>
                  <label htmlFor="ollama-base-url" className="block text-sm font-medium text-gray-400 mb-1">{t('ollamaServerUrlLabel')}</label>
                  <input 
                    type="text" 
                    id="ollama-base-url"
                    name="baseUrl"
                    value={config.ollama.baseUrl}
                    onChange={handleOllamaChange}
                    className="w-full bg-gray-900 border border-gray-700 text-white rounded-md shadow-sm focus:ring-white focus:border-white p-2.5 transition-colors font-mono"
                    placeholder="http://localhost:11434"
                  />
               </div>
                <div>
                  <label htmlFor="ollama-model" className="block text-sm font-medium text-gray-400 mb-1">{t('modelNameLabel')}</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      id="ollama-model"
                      name="model"
                      list="ollama-models-list"
                      value={config.ollama.model}
                      onChange={handleOllamaChange}
                      className="w-full bg-gray-900 border border-gray-700 text-white rounded-md shadow-sm focus:ring-white focus:border-white p-2.5 transition-colors font-mono"
                      placeholder="e.g., llava:latest"
                    />
                    <datalist id="ollama-models-list">
                      {config.ollama.models.map(m => <option key={m} value={m} />)}
                    </datalist>
                    <button
                      type="button"
                      onClick={handleApplyClick}
                      disabled={disabled}
                      className="px-4 py-2 bg-gray-700 text-white font-semibold rounded-md hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed"
                    >
                      Apply Model
                    </button>
                  </div>
               </div>
                <div className="!mt-6 p-4 bg-black/20 border border-gray-800 rounded-md text-gray-400">
                  <h3 className="font-semibold text-gray-300">{t('ollamaImportantNoteTitle')}</h3>
                  <p className="mt-2">{t('ollamaImportantNoteDesc')}</p>
                  <ul className="mt-2 space-y-2 list-disc list-inside text-xs">
                    <li className="font-sans"><span className="font-bold text-gray-300">{t('ollamaWindows')}</span>
                      <ol className="list-decimal list-inside pl-4 mt-1">
                        <li>{t('ollamaWindowsStep1')} <code className="font-mono bg-gray-700/50 p-1 rounded">set OLLAMA_ORIGINS=*</code></li>
                        <li>{t('ollamaWindowsStep2')} <code className="font-mono bg-gray-700/50 p-1 rounded">ollama serve</code></li>
                      </ol>
                    </li>
                  </ul>
                   <p className="mt-2 text-xs">{t('ollamaFinalHint')}</p>
                  <div className="mt-3 p-3 bg-gray-900 border border-gray-800 rounded-md text-xs text-gray-300">
                    <h4 className="font-semibold mb-2">To get the Ollama model name from the models installed on your device:</h4>
                    <ol className="list-decimal list-inside space-y-2">
                      <li>Open a Command Prompt (CMD).</li>
                      <li>Run the command <code className="font-mono bg-gray-700/50 p-1 rounded">ollama list</code> and press Enter.</li>
                      <li>From the listed models, copy the model name (for example: <code className="font-mono bg-gray-700/50 p-1 rounded">gemma3:4b</code>). Make sure the model is a vision-capable model.</li>
                      <li>Paste the full model name into the empty "Model Name" box above.</li>
                      <li>Press the "Apply Model" button to apply the model to the app.</li>
                    </ol>
                  </div>
                </div>
            </div>
          )}
        </div>
      </fieldset>
    </div>
  );
};

export default ModelSelector;