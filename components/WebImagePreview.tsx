import React, { useState, useEffect } from 'react';
import { WebInspiration } from '../types';

declare global {
  interface Window {
    APIFLASH_KEY: string;
  }
}

interface WebImagePreviewProps {
  image: WebInspiration;
  className?: string;
}

export const WebImagePreview: React.FC<WebImagePreviewProps> = ({ image, className = '' }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  useEffect(() => {
    const loadPreview = async () => {
      try {
        // If the service already provided a preview URL, try it first
        if (image.previewUrl) {
          const testImg = new Image();
          await new Promise<void>((resolve, reject) => {
            testImg.onload = () => resolve();
            testImg.onerror = () => reject(new Error('previewUrl failed to load'));
            testImg.src = image.previewUrl as string;
          });
          setPreviewUrl(image.previewUrl as string);
          setStatus('loaded');
          return;
        }

        // Try Microlink screenshot API (no key required for basic usage). If it returns a screenshot URL use it.
        try {
          const ogResponse = await fetch(`https://api.microlink.io?url=${encodeURIComponent(image.uri)}&screenshot=true&meta=false`);
          const ogData = await ogResponse.json();
          if (ogData && ogData.status === 'success' && ogData.data && ogData.data.screenshot && ogData.data.screenshot.url) {
            setPreviewUrl(ogData.data.screenshot.url);
            setStatus('loaded');
            return;
          }
        } catch (err) {
          // Non-fatal: we'll try next fallback
          console.warn('Microlink screenshot failed or blocked by CORS:', err);
        }

        // Fallback to ApiFlash only if the client has an APIFLASH key configured on window
        if (window.APIFLASH_KEY) {
          const screenshotUrl = `https://api.apiflash.com/v1/urltoimage?access_key=${window.APIFLASH_KEY}&url=${encodeURIComponent(image.uri)}&format=jpeg&quality=80&thumbnail_width=800`;
          const img = new Image();
          img.onload = () => {
            setPreviewUrl(screenshotUrl);
            setStatus('loaded');
          };
          img.onerror = () => {
            setStatus('error');
          };
          img.src = screenshotUrl;
          return;
        }

        // No preview available and no API key for screenshots
        console.warn('No preview available and APIFLASH_KEY not set on window.');
        setStatus('error');
      } catch (error) {
        console.error('Error loading preview:', error);
        setStatus('error');
      }
    };

    loadPreview();
  }, [image.uri]);

  if (status === 'loading') {
    const normalize = (u: string) => (u && /^https?:\/\//i.test(u) ? u : `https://${u}`);
    const handleOpenLoading = (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        const target = normalize(image.uri);
        console.debug('Opening external site from loading state:', target);
        window.open(target, '_blank', 'noopener');
      } catch (err) {
        console.warn('Failed to open external site for', image.uri, err);
      }
    };

    return (
      <div onClick={handleOpenLoading} className={`${className} animate-pulse bg-gray-800 flex items-center justify-center cursor-pointer`}>
        <div className="text-gray-600">Loading preview...</div>
      </div>
    );
  }

  if (status === 'error' || !previewUrl) {
    const normalize = (u: string) => (u && /^https?:\/\//i.test(u) ? u : `https://${u}`);
    const handleOpenError = (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        const target = normalize(image.uri);
        console.debug('Opening external site from error state:', target);
        window.open(target, '_blank', 'noopener');
      } catch (err) {
        console.warn('Failed to open external site for', image.uri, err);
      }
    };

    return (
      <div onClick={handleOpenError} className={`${className} bg-gray-900 flex items-center justify-center p-4 cursor-pointer`}> 
        <div className="text-center">
          <button onClick={(e) => { e.stopPropagation(); handleOpenError(e); }} className="inline-block text-sm text-gray-300 hover:text-white hover:underline" aria-label={`Open ${image.title} page`}>
            Open page
          </button>
        </div>
      </div>
    );
  }

  const normalize = (u: string) => (u && /^https?:\/\//i.test(u) ? u : `https://${u}`);
  const handleOpenLoaded = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const target = normalize(image.uri);
      console.debug('Opening external site from loaded state:', target);
      window.open(target, '_blank', 'noopener');
    } catch (err) {
      console.warn('Failed to open external site for', image.uri, err);
    }
  };

  return (
    <div onClick={handleOpenLoaded} className={`${className} object-cover cursor-pointer`}>
      <img
        src={previewUrl}
        alt={image.title}
        className="w-full h-full object-cover"
        loading="lazy"
      />
    </div>
  );
};