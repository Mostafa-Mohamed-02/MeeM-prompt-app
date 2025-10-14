import React from 'react';
import { useLocalization } from '../hooks/useLocalization';

interface LoaderProps {
  message: string;
  onStop?: () => void;
}

const Loader: React.FC<LoaderProps> = ({ message, onStop }) => {
  const { t } = useLocalization();
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <svg className="animate-spin h-12 w-12 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <p className="mt-4 text-lg font-semibold text-gray-400 animate-pulse">{message}</p>
      {onStop && (
        <button
          onClick={onStop}
          className="mt-6 px-5 py-2.5 bg-gray-800 text-white font-semibold rounded-lg shadow-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-red-500 transition-all duration-300"
          aria-label={t('stopGeneration')}
        >
          {t('stopGeneration')}
        </button>
      )}
    </div>
  );
};

export default Loader;