import React, { useEffect, useState } from 'react';
import { useLocalization } from '../hooks/useLocalization';
import { HistoryState, HistoryItem } from '../types';
import { historyService } from '../services/historyService';
import HistoryIcon from './HistoryIcon';
// sound effects removed

interface HistoryPanelProps {
  onSelectItem: (item: HistoryItem) => void;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ onSelectItem }) => {
  const { t } = useLocalization();
  const [history, setHistory] = useState<HistoryState>(historyService.getHistory());
  const [isExpanded, setIsExpanded] = useState(false);
  const [panelHeight, setPanelHeight] = useState<number>(80); // percentage of viewport height
  // sound effects removed

  useEffect(() => {
    const update = () => setHistory(historyService.getHistory());
    const unsub = historyService.subscribe(update);
    update();
    return unsub;
  }, []);

  const handleItemClick = (item: HistoryItem) => {
    historyService.setSelectedItem(item.id);
    onSelectItem(item);
    setHistory({ ...history, selectedItemId: item.id });
    setIsExpanded(false); // Collapse after selection
  };

  const handleDeleteItem = (e: React.MouseEvent, item: HistoryItem) => {
    e.stopPropagation();
    if (window.confirm(t('confirmDeleteHistoryItem'))) {
      historyService.deleteItem(item.id);
      setHistory(historyService.getHistory());
    }
  };

  return (
    // Inline panel for header row, not fixed. Sits at right end of header flex.
    <div
      className={`relative transition-all duration-300 ease-in-out`}
      style={{ width: isExpanded ? 320 : 48 }}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* History Icon Button (visible at right end of header row) */}
      <div className="bg-gray-800 rounded-lg p-2 cursor-pointer shadow-lg flex items-center justify-center">
        <HistoryIcon className="w-6 h-6 text-gray-400" />
      </div>

      {/* Side Panel Content */}
      <div
        className={`absolute right-full top-0 bg-gray-900 border-l border-gray-800 rounded-l-lg shadow-xl overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'opacity-100' : 'opacity-0'}`}
        style={{ width: isExpanded ? 320 : 0, height: `${panelHeight}vh`, zIndex: 9999 }}
      >
        <div className="p-3 flex items-center justify-between border-b border-gray-800">
          <div />
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <HistoryIcon className="w-4 h-4 text-gray-400" />
              <label className="text-sm text-gray-400">{t('height')}</label>
            </div>
            <input
              type="range"
              min={20}
              max={95}
              value={panelHeight}
              onChange={(e) => setPanelHeight(Number(e.target.value))}
              className="w-24"
            />
            <button
              onClick={() => { 
                            if (window.confirm(t('confirmClearAll'))) { 
                  historyService.clearAll(); 
                  setHistory(historyService.getHistory()); 
                } 
              }}
              className="ml-2 bg-red-600 hover:bg-red-700 text-white text-sm px-2 py-1 rounded"
            >
              {t('clearAll')}
            </button>
          </div>
        </div>
        <div className="p-4">
          {history.items.length === 0 ? (
            <p className="text-gray-500 text-center">{t('historyEmpty')}</p>
          ) : (
            <div className="space-y-4 overflow-y-auto" style={{ maxHeight: `calc(${panelHeight}vh - 5rem)` }}>
              {history.items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`relative group cursor-pointer ${history.selectedItemId === item.id ? 'ring-2 ring-blue-500' : ''}`}
                >
                  <div className="w-full h-32 rounded-lg bg-gray-800 overflow-hidden flex items-center justify-center relative">
                    <img
                      src={item.dataUrl}
                      alt={item.fileName}
                      className="max-h-full max-w-full object-contain"
                      draggable={true}
                      onDragStart={(e) => {
                        try {
                          // Attach the dataUrl so drop targets can read it
                          e.dataTransfer.setData('application/x-image-dataurl', item.dataUrl || '');
                          // Also set plain text/uri-list for broader compatibility
                          e.dataTransfer.setData('text/plain', item.dataUrl || '');
                        } catch (err) {
                          console.debug('Drag start failed', err);
                        }
                      }}
                    />
                    <button
                      onClick={(e) => handleDeleteItem(e, item)}
                      className="absolute top-2 right-2 bg-red-500 rounded-full p-1 hidden group-hover:block z-20"
                      aria-label={t('deleteHistoryItem')}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 text-white"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-xs text-white p-1 rounded-b-lg">
                    {new Date(item.timestamp).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryPanel;