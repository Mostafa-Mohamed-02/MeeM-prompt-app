import React from 'react';
import { useLocalization } from '../hooks/useLocalization';
import logoUrl from '/assets/logo.png?url';
import HistoryPanel from './HistoryPanel';
import { HistoryItem } from '../types';

interface HeaderProps {
  onHistorySelect?: (item: HistoryItem) => void;
}

const Header: React.FC<HeaderProps> = ({ onHistorySelect }) => {
  const { t } = useLocalization();

  return (
    <header className="relative py-3 px-4 sm:px-6 lg:px-8">
      {/* Gradient border bottom */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-[1px]" 
        style={{ 
          background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
          opacity: 0.3 
        }} 
      />
      {/* Glass backdrop */}
      <div 
        className="absolute inset-0 backdrop-blur-sm"
        style={{ 
          background: 'linear-gradient(180deg, rgba(109, 40, 217, 0.12), rgba(79, 70, 229, 0.06))',
          zIndex: -1 
        }}
      />
      {/* Content */}
      <div className="w-full mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <div className="flex items-center">
              <div className="relative">
                <div className="absolute inset-0 animate-pulse"
                     style={{ 
                       background: 'radial-gradient(circle, rgba(139, 92, 246, 0.2), transparent 70%)',
                       filter: 'blur(10px)',
                       transform: 'scale(1.2)'
                     }} />
                <img src={logoUrl} 
                     alt="MeeM-prompt logo" 
                     className="h-10 relative hover:scale-105 transition-transform duration-300 ease-out"
                     style={{ filter: 'drop-shadow(0 0 10px rgba(139, 92, 246, 0.25))' }} />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-violet-400 to-blue-500 font-display ml-4"
                  style={{ textShadow: '0 0 22px rgba(139, 92, 246, 0.25)' }}>
                {t('appTitle')}
              </h1>
            </div>
            <p className="text-sm sm:text-base text-gray-300 font-body max-w-3xl opacity-90 mt-2">
              {t('appSubtitle')}
            </p>
          </div>
          {/* Right side: history, feedback and sound toggle */}
          <div className="flex items-center h-full space-x-3">
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLSeZgFfZDSemW685YGc36TOdvW95YKN2ItFLn8dw9RMpRWn-Pw/viewform?usp=dialog"
              target="_blank"
              rel="noopener noreferrer"
              title={t('feedback')}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-gray-900 hover:bg-gray-800 text-gray-200 text-sm font-semibold transition-colors"
            >
              {/* Feedback icon */}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
              <span className="hidden sm:inline">{t('feedback')}</span>
            </a>
            <HistoryPanel onSelectItem={onHistorySelect || (() => {})} />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;