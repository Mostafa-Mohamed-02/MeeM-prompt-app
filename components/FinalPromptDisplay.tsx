import React, { useState } from 'react';
import { useLocalization } from '../hooks/useLocalization';

interface FinalPromptDisplayProps {
  prompt: string;
  onRegenerate: (editedText: string) => void; // kept for compatibility but unused
  disabled: boolean;
}

const FinalPromptDisplay: React.FC<FinalPromptDisplayProps> = ({ prompt, /*onRegenerate,*/ disabled }) => {
  const [copied, setCopied] = useState(false);
  const { t } = useLocalization();

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
  <div className="mt-10 w-full mx-auto fade-in-up">
      <h2 className="text-2xl font-bold text-center mb-4 text-white font-display tracking-wide">{t('artisticPromptTitle')}</h2>
      <div className="bg-gray-950 rounded-lg p-6 shadow-lg relative">
        <p className="text-gray-300 text-base leading-relaxed whitespace-pre-wrap font-body">
          {prompt}
        </p>
        <div className="absolute top-4 right-4 flex gap-2">
          <button
            onClick={handleCopy}
            className="bg-gray-700 text-gray-200 p-2 rounded-md hover:bg-gray-600 transition-all"
            aria-label={t('copyPrompt')}
          >
            {copied ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            ) : (
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        </div>
      </div>
      <p className="text-center text-xs mt-2 text-gray-600 transition-opacity duration-300">
         {copied ? t('copied') : t('copyHint')}
      </p>
    </div>
  );
};

export default FinalPromptDisplay;