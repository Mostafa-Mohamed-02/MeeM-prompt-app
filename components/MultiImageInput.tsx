import React, { useCallback, useRef, useState } from 'react';
import { MultiImageInputState, Mask } from '../types';
import CanvasMask from './CanvasMask';
import { useLocalization } from '../hooks/useLocalization';

interface MultiImageInputProps {
  item: MultiImageInputState;
  onUpdate: (id: string, updates: Partial<MultiImageInputState>) => void;
  onRemove: (id: string) => void;
  disabled: boolean;
}

const MultiImageInput: React.FC<MultiImageInputProps> = ({ item, onUpdate, onRemove, disabled }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const { t } = useLocalization();

  const handleFileChange = useCallback((files: FileList | null) => {
    if (files && files[0]) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const dataUrl = e.target?.result as string;
          try {
            // Save to history service right away
            const { historyService } = await import('../services/historyService');
            historyService.saveImageBackground(file);
          } catch (e) {
            console.debug('Failed to save image to history:', e);
          }
          // default maskEnabled to true for new images
          onUpdate(item.id, { dataUrl, file, mask: null, imageRef, maskEnabled: true });
        };
        reader.readAsDataURL(file);
      }
    }
  }, [onUpdate, item.id]);

  const [isDragActive, setIsDragActive] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    // Only reset when leaving the element (not its children)
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setIsDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(false);
    const files = e.dataTransfer.files;
    if (files && files.length) {
      handleFileChange(files);
    }
  }, [handleFileChange]);

  // Accept dataUrl drops from history panel
  const handleDropDataUrl = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(false);
    const dataUrl = e.dataTransfer.getData('application/x-image-dataurl') || e.dataTransfer.getData('text/plain');
    if (dataUrl && dataUrl.startsWith('data:')) {
      try {
        const parts = dataUrl.split(',');
        const meta = parts[0];
        const base64 = parts[1];
        const m = meta.match(/data:(.*);base64/);
        const mimeType = m ? m[1] : 'image/png';
        const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        const file = new File([binary], `history-${Date.now()}.png`, { type: mimeType });
        onUpdate(item.id, { dataUrl, file });
      } catch (err) {
        console.debug('Failed to handle dropped dataUrl', err);
      }
    }
  }, [onUpdate, item.id]);

  const onAreaClick = useCallback(() => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  }, [disabled]);

  const handleMaskChange = (mask: Mask) => {
    onUpdate(item.id, { mask });
  };

  const toggleMaskEnabled = () => {
    const newVal = !item.maskEnabled;
    // If being turned off, also clear any existing mask so it is removed immediately
    onUpdate(item.id, { maskEnabled: newVal, mask: newVal ? item.mask : null });
  };
  
  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdate(item.id, { prompt: e.target.value });
  }

  // Treat missing maskEnabled as true (backwards compatibility)
  const isMaskEnabled = item.maskEnabled ?? true;
  const canvasDisabled = disabled || !isMaskEnabled;

  return (
    <div className="relative group">
      <div className="bg-gray-950 p-4 rounded-lg border border-gray-800 space-y-3 transition-all duration-300 ease-in-out origin-center group-hover:scale-110 group-hover:z-20 group-hover:shadow-2xl group-hover:shadow-black/50">
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => handleFileChange(e.target.files)}
          accept="image/*"
          className="hidden"
          disabled={disabled}
        />
        <div
          className={`relative w-full aspect-square bg-black/50 rounded-md overflow-hidden transition-colors ${isDragActive && !disabled ? 'ring-2 ring-offset-2 ring-blue-400' : ''}`}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={(e) => { handleDrop(e); handleDropDataUrl(e); }}
          role="button"
          aria-label={t('addImage')}
        >
          {/* Brush toggle button in the top-right corner of the image area */}
          {item.dataUrl && (
            <div className="absolute top-2 right-2 z-30">
              <button
                type="button"
                onClick={toggleMaskEnabled}
                aria-pressed={!!item.maskEnabled}
                aria-label={item.maskEnabled ? 'Disable mask drawing' : 'Enable mask drawing'}
                className={`relative p-2 rounded-full transition-all duration-150 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-1 ${item.maskEnabled ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white transform hover:scale-105' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                disabled={disabled}
                title={item.maskEnabled ? 'Disable mask (brush)' : 'Enable mask (brush)'}
              >
                {/* Improved brush icon */}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 17.25V21h3.75L17.81 9.94a2.25 2.25 0 000-3.18l-1.57-1.57a2.25 2.25 0 00-3.18 0L3 17.25z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.5 6.5l3 3" />
                </svg>
                {/* Active small badge */}
                {item.maskEnabled && (
                  <span className="absolute -top-1 -right-1 block h-3 w-3 rounded-full bg-white ring-2 ring-blue-500" />
                )}
              </button>
            </div>
          )}
          {item.dataUrl ? (
            <CanvasMask 
              imageUrl={item.dataUrl}
              onMaskChange={handleMaskChange}
              // Disable canvas when either parent disabled or the per-item mask toggle is off
              disabled={canvasDisabled}
              imageRef={imageRef}
              mask={item.mask ?? null}
            />
          ) : (
            <div
              onClick={onAreaClick}
              className={`w-full h-full flex flex-col justify-center items-center text-gray-500 border-2 border-dashed border-gray-700 rounded-md transition-colors ${!disabled ? 'cursor-pointer hover:border-gray-500 hover:text-gray-400' : 'cursor-not-allowed'}`}
            >
               <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              <p className="mt-2 text-sm">{t('addImage')}</p>
              <p className="mt-1 text-xs text-gray-600">Drop an image here to add</p>
            </div>
          )}
        </div>

        <div className="w-full">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-gray-400">Specific instruction</label>
            <button
              type="button"
              onClick={() => onUpdate(item.id, { prompt: 'Extract only the requested elements. Describe materials, color, position, and stylistic details relevant to the instruction. Be concise and architectural.' })}
              disabled={disabled}
              className="text-xs text-blue-400 hover:underline"
            >
              Use template
            </button>
          </div>
          <textarea
            value={item.prompt}
            onChange={handlePromptChange}
            disabled={disabled}
            placeholder={t('multiImagePromptPlaceholder')}
            className="w-full h-24 bg-gray-900 border border-gray-700 text-gray-300 rounded-md p-2 text-sm focus:ring-white focus:border-white transition-colors"
          />
        </div>
        
        <div className="text-right flex items-center justify-end gap-4">
           {item.dataUrl && (
             <button
                onClick={onAreaClick}
                disabled={disabled}
                className="text-xs font-semibold text-gray-500 hover:text-blue-400 disabled:text-gray-700 disabled:cursor-not-allowed transition-colors"
            >
                {t('replace')}
            </button>
          )}
          <button
              onClick={() => onRemove(item.id)}
              disabled={disabled}
              className="text-xs font-semibold text-gray-500 hover:text-red-400 disabled:text-gray-700 disabled:cursor-not-allowed transition-colors"
          >
              {t('remove')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MultiImageInput;