import React, { useState } from 'react';
import { FinalPrompt } from '../types';
import { useLocalization } from '../hooks/useLocalization';

interface JsonPromptDisplayProps {
  jsonPrompt: FinalPrompt['jsonPrompt'];
}

const JsonPromptDisplay: React.FC<JsonPromptDisplayProps> = ({ jsonPrompt }) => {
  const [copied, setCopied] = useState(false);
  const { t } = useLocalization();
  const jsonString = JSON.stringify(jsonPrompt, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
  <div className="w-full mx-auto fade-in-up">
      <h2 className="text-2xl font-bold text-center mb-4 text-white font-display tracking-wide">{t('jsonPromptTitle')}</h2>
      <div className="bg-gray-950 rounded-lg shadow-lg relative font-mono text-sm">
        <pre className="p-6 text-gray-300 overflow-x-auto">
          <code>{jsonString}</code>
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-4 right-4 bg-gray-700 text-gray-200 font-semibold py-2 px-4 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-white transition-all duration-200 hover:shadow-glow"
          aria-label={t('copyPrompt')}
        >
          {copied ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-2M8 5a2 2 0 002 2h4a2 2 0 002-2M8 5a2 2 0 012-2h4a2 2 0 012 2m-6 9v3" />
            </svg>
          )}
        </button>
      </div>
       <p className="text-center text-xs mt-2 text-gray-600 transition-opacity duration-300">
         {copied ? t('copied') : t('copyJsonHint')}
       </p>
    </div>
  );
};

export default JsonPromptDisplay;