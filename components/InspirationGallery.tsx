import React, { useEffect, useState } from 'react';
import { WebInspiration } from '../types';
import { useLocalization } from '../hooks/useLocalization';
import { WebImagePreview } from './WebImagePreview';

interface WebInspirationGalleryProps {
  originalImage: WebInspiration;
  inspirationImages: WebInspiration[];
  onSelect: (image: WebInspiration) => void;
  isLoading: boolean;
}

const InspirationCard: React.FC<{ image: WebInspiration; onSelect: (image: WebInspiration) => void; isOriginal?: boolean; isLoading: boolean }> = ({ image, onSelect, isOriginal = false, isLoading }) => {
  const { t } = useLocalization();

  const handleSelect = () => {
    if (!isLoading) {
      onSelect(image);
    }
  };
  
  const isGenerated = image.source === 'AI Generated';
  // compute a normalized URL and hostname for display/opening
  let normalizedUrl = image.uri;
  try {
    if (!/^https?:\/\//i.test(normalizedUrl)) normalizedUrl = `https://${normalizedUrl}`;
  } catch (e) {
    // leave as-is
  }
  let hostname = image.source || image.uri;
  try {
    hostname = new URL(normalizedUrl).hostname;
  } catch (e) {
    // fallback to provided source/uri
  }

  const clickHandler = () => {
    if (isOriginal) {
      handleSelect();
    } else if (!isLoading) {
      try {
        window.open(normalizedUrl, '_blank', 'noopener,noreferrer');
      } catch (e) {
        // fallback: navigate
        window.location.href = normalizedUrl;
      }
    }
  };

  return (
    <div className="inspiration-card fade-in-up">
      <div 
        className={`inspiration-card relative group overflow-hidden rounded-lg shadow-lg ${isOriginal ? 'bg-gray-800' : 'bg-transparent'} transition-all duration-300 cursor-pointer hover:shadow-glow`}
        onClick={clickHandler}
        style={{ width: '220px', minWidth: '220px', maxWidth: '220px', height: '320px', minHeight: '320px', maxHeight: '320px' }}
      >
          {isOriginal ? (
            <img 
              src={image.uri} 
              alt={image.title} 
              className="w-full h-full object-cover transition-all duration-300 grayscale group-hover:scale-110 group-hover:grayscale-0" 
              onError={e => { (e.currentTarget as HTMLImageElement).src = '/assets/placeholder.png'; }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center inspiration-bubble-card btn-bubbled animate-bubble-pop p-0">
              <span className="text-white font-semibold text-sm tracking-wide px-4 py-2">{hostname}</span>
            </div>
          )}
          <div className="absolute inset-0 border-4 border-transparent group-hover:border-white transition-all duration-300 rounded-lg pointer-events-none"></div>
      </div>
      <div className="pt-3 text-left">
        {isOriginal ? (
          <h3 className="text-gray-200 font-bold text-sm line-clamp-2 h-10">{image.title}</h3>
        ) : null}
      </div>
    </div>
  );
};

const WebInspirationGallery: React.FC<WebInspirationGalleryProps> = ({ originalImage, inspirationImages, onSelect, isLoading }) => {
  const allImages = [originalImage, ...inspirationImages];
  const { t } = useLocalization();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setShow(true), 30);
    return () => clearTimeout(id);
  }, []);

  // debug panel intentionally removed per user request

  return (
    <div className="w-full mx-auto fade-in">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white font-display tracking-wide">{t('inspirationsTitle')}</h2>
        <p className="mt-2 text-gray-400">{t('inspirationsDescription')}</p>
      </div>
      <div className="flex justify-center">
        <div className={`grid inline-grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-x-6 gap-y-8 justify-items-center ${show ? 'show' : ''}`}>
          {allImages.map((image, index) => (
            <InspirationCard 
              key={`${image.source}-${index}`} 
              image={image} 
              onSelect={onSelect}
              isOriginal={index === 0}
              isLoading={isLoading}
            />
          ))}
        </div>
      </div>
      {/* search debug removed */}
    </div>
  );
};

export default WebInspirationGallery;