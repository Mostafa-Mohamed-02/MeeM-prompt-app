import React, { useState, useCallback, useRef } from 'react';
import { useLocalization } from '../hooks/useLocalization';

interface ImageUploaderProps {
  onImageChange: (imageDataUrl: string, file: File) => void;
  onClear: () => void;
  disabled: boolean;
  imagePreviewUrl: string | null;
  isLoading?: boolean;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageChange, onClear, disabled, imagePreviewUrl, isLoading }) => {
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useLocalization();
  // sound effects removed

  const handleFileChange = useCallback((files: FileList | null) => {
    if (files && files[0]) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          onImageChange(result, file);
        };
        reader.readAsDataURL(file);
      }
    }
  }, [onImageChange]);

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if(!disabled) setDragOver(true);
  }, [disabled]);

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (!disabled) {
      // If the drag originated from the history panel it may include a dataUrl
      const dataUrl = e.dataTransfer.getData('application/x-image-dataurl') || e.dataTransfer.getData('text/plain');
      if (dataUrl && dataUrl.startsWith('data:')) {
        try {
          // Convert dataUrl to File
          const parts = dataUrl.split(',');
          const meta = parts[0];
          const base64 = parts[1];
          const m = meta.match(/data:(.*);base64/);
          const mimeType = m ? m[1] : 'image/png';
          const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
          const file = new File([binary], `history-${Date.now()}.png`, { type: mimeType });
          onImageChange(dataUrl, file);
        } catch (err) {
          console.debug('Failed to handle dropped dataUrl', err);
        }
      } else {
        handleFileChange(e.dataTransfer.files);
      }
    }
  }, [disabled, handleFileChange]);

  const onAreaClick = useCallback(() => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  }, [disabled]);
  
  const clearImage = () => {
    if(fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onClear();
  };

  const handleClearClick = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.stopPropagation();
  clearImage();
  };

  return (
  <div className="w-full mx-auto">
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => handleFileChange(e.target.files)}
        accept="image/*"
        className="hidden"
        disabled={disabled}
      />
      {imagePreviewUrl ? (
        <div 
          className={`relative group rounded-lg overflow-hidden max-h-[60vh] ${!disabled ? 'cursor-pointer' : 'cursor-default'}`}
          onClick={!disabled ? onAreaClick : undefined}
          aria-label={!disabled ? "Click to replace image" : "Image preview"}
        >
           <img src={imagePreviewUrl} alt="Preview" className="w-full h-auto max-h-[60vh] object-contain shadow-lg transition-all duration-300 group-hover:scale-105 group-hover:grayscale" />
           
           {/* Replace overlay, only appears when not disabled */}
           {!disabled && (
             <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all duration-300 flex justify-center items-center">
               <div className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                  </svg>
                  <p className="mt-2 font-semibold text-lg">{t('replaceImage')}</p>
               </div>
             </div>
           )}
           
           {/* Remove button in the corner */}
           {!disabled && (
             <div className="absolute top-2 right-2">
                <button 
                    onClick={handleClearClick}
                    className="bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-75 transition-all opacity-0 group-hover:opacity-100"
                    aria-label={t('removeImage')}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
             </div>
           )}
          {/* Loading indicator under preview */}
          {isLoading && (
            <div className="absolute left-0 right-0 bottom-0 flex justify-center pb-3 pointer-events-none">
              <div className="flex items-center gap-2 bg-black bg-opacity-60 text-white text-sm rounded-full px-3 py-1">
                <span className="inline-block w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin" aria-hidden="true"></span>
                <span>Analyzing...</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          onClick={onAreaClick}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`
            flex justify-center items-center w-full h-64 px-6 py-10
            border-2 border-dashed rounded-lg cursor-pointer
            transition-all duration-300
            ${disabled ? 'cursor-not-allowed bg-black/50' : 'hover:border-gray-400 hover:bg-black/20'}
            ${dragOver ? 'border-white bg-black/20 animate-pulse shadow-glow' : 'border-gray-700 bg-black/50'}
          `}
        >
          <div className="text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="mt-4 text-sm text-gray-400">
              <span className="font-semibold text-gray-300 hover:text-white transition-colors">{t('uploadCTA')}</span> {t('uploadOrDrag')}
            </p>
            <p className="text-xs text-gray-500">{t('uploadHint')}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageUploader;