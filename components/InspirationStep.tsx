import React from 'react';
import { useLocalization } from '../hooks/useLocalization';

interface InspirationStepProps {
  onAnalyze: () => void;
  disabled: boolean;
  isLoading?: boolean;
}

const InspirationStep: React.FC<InspirationStepProps> = ({ onAnalyze, disabled, isLoading }) => {
  const { t } = useLocalization();
  return (
    <div className="max-w-3xl mx-auto text-center p-6 bg-gray-950 rounded-lg fade-in-up">
      {/* Inspiration count selector removed per user request */}
  {/* Heading removed per user request */}
  <p className="mt-2 mb-6 text-gray-400">{t('choosePathDescription')}</p>
      <div className="flex justify-center">
        <button
          onClick={onAnalyze}
          disabled={disabled}
          className="btn-wave disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoading && <span className="inline-block w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin" aria-hidden="true"></span>}
          {t('refineAttributes')}
        </button>
      </div>
    </div>
  );
};

export default InspirationStep;