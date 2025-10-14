import React, { useEffect, useState } from 'react';
import { useLocalization } from '../hooks/useLocalization';

interface HistoryProps {
  onSelect: (dataUrl: string, filename?: string) => void;
  serverBase?: string; // e.g. http://localhost:4002
}

interface Item {
  filename: string;
  url?: string;
  dataUrl?: string;
}

const HISTORY_KEY = 'meem_input_history_v1';

const History: React.FC<HistoryProps> = ({ onSelect, serverBase = 'http://localhost:4002' }) => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const { t } = useLocalization();

  const load = async () => {
    setLoading(true);
    // Try server first
    try {
      const res = await fetch(`${serverBase}/list`);
      if (res.ok) {
        const json = await res.json();
        const mapped = (json as Array<any>).map(s => ({ 
          filename: s.filename, 
          url: s.url ? (s.url.startsWith('http') ? s.url : `${serverBase}${s.url}`) : `${serverBase}/files/${encodeURIComponent(s.filename)}`
        }));
        setItems(mapped);
        setLoading(false);
        return;
      }
    } catch (e) {
      // server not available, fall through to localStorage
    }

    // Fallback to localStorage
    try {
      const raw = window.localStorage.getItem(HISTORY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Array<any>;
        const mapped = parsed.map(p => ({ 
          filename: p.filename || p.id, 
          dataUrl: p.dataUrl 
        }));
        setItems(mapped);
      } else {
        setItems([]);
      }
    } catch (e) {
      console.warn('Could not load history from localStorage', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    if (mounted) load();
    const onUpdate = () => { load(); };
    window.addEventListener('meem:history-updated', onUpdate as EventListener);
    return () => { mounted = false; window.removeEventListener('meem:history-updated', onUpdate as EventListener); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverBase]);

  const handleClick = async (it: Item) => {
    try {
      if (it.dataUrl) {
        onSelect(it.dataUrl, it.filename);
        return;
      }
      if (!it.url) return;
      
      const res = await fetch(it.url);
      if (!res.ok) throw new Error('Failed to fetch file');
      const blob = await res.blob();
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      onSelect(dataUrl, it.filename);
    } catch (e) {
      console.error('Failed to load history item', e);
    }
  };

  const ensurePreview = async (it: Item, retryUrl?: string) => {
    if (it.dataUrl) return it.dataUrl;
    
    const urlToTry = retryUrl || it.url;
    if (!urlToTry) return null;

    try {
      const res = await fetch(urlToTry);
      if (!res.ok) {
        // If server URL fails and we haven't tried the /files endpoint yet, try that
        if (!retryUrl && it.filename) {
          return ensurePreview(it, `${serverBase}/files/${encodeURIComponent(it.filename)}`);
        }
        throw new Error('Failed to fetch for preview');
      }
      const blob = await res.blob();
      const obj = URL.createObjectURL(blob);
      // store object URL in state so future renders use it
      setItems(prev => prev.map(p => p.filename === it.filename ? { ...p, dataUrl: obj } : p));
      return obj;
    } catch (e) {
      console.warn('Preview fetch failed', e);
      return null;
    }
  };

  const deleteItem = async (filename?: string) => {
    if (!filename) return;
    // Try server delete first
    try {
      const res = await fetch(`${serverBase}/files/${encodeURIComponent(filename)}`, { method: 'DELETE' });
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('meem:history-updated'));
        await load();
        return;
      }
    } catch (e) {
      // ignore
    }

    // Remove from localStorage fallback
    try {
      const raw = window.localStorage.getItem(HISTORY_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Array<any>;
      const filtered = parsed.filter(p => (p.filename || p.id) !== filename);
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
      await load();
    } catch (e) {
      console.warn('Failed to remove history entry locally', e);
    }
  };

  const clearAll = async () => {
    try {
      const res = await fetch(`${serverBase}/clear`, { method: 'POST' });
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('meem:history-updated'));
        await load();
        return;
      }
    } catch (e) {
      // ignore
    }

    try {
      window.localStorage.removeItem(HISTORY_KEY);
      await load();
    } catch (e) {
      console.warn('Failed to clear local history', e);
    }
  };

  // De-duplicate items based on dataUrl (if present) or the actual image content
  const uniqueItems = items.reduce((acc, item) => {
    const key = item.dataUrl || item.url || item.filename;
    if (!acc.has(key)) {
      acc.set(key, item);
    }
    return acc;
  }, new Map<string, Item>());

  return (
    <div className="fixed right-4 top-24 z-50">
      <div className="group">
        <div className="w-12 group-hover:w-64 transition-all duration-200 ease-in-out origin-right">
          <div className="bg-gray-900 border border-gray-800 rounded-l-lg overflow-hidden shadow-lg">
            <div className="px-3 py-2 flex items-center justify-between">
              {/* History icon instead of text */}
              <button 
                title={t('historyTitle') || 'Input History'} 
                className="text-gray-300 hover:text-gray-100"
                onClick={(e) => e.stopPropagation()}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
              </button>
              {/* Clear button (only visible on hover) */}
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button 
                  title="Clear History" 
                  onClick={(e) => { e.stopPropagation(); clearAll(); }} 
                  className="text-xs text-gray-400 hover:text-red-400"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Image grid (expands on hover) */}
            <div className="px-2 pb-2 max-h-[70vh] overflow-y-auto opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              {loading && (
                <div className="p-3 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-gray-500 border-t-gray-200 rounded-full animate-spin"></div>
                </div>
              )}
              
              {!loading && Array.from(uniqueItems.values()).length === 0 && (
                <div className="p-3 text-xs text-gray-500 text-center">{t('historyEmpty') || 'No saved inputs yet'}</div>
              )}

              <div className="grid grid-cols-2 gap-2 p-2">
                {Array.from(uniqueItems.values()).map((it: Item) => (
                  <div key={it.filename} className="relative group/item">
                    <button 
                      onClick={() => handleClick(it)} 
                      className="w-full aspect-square rounded overflow-hidden hover:ring-2 hover:ring-purple-500 transition-all duration-200"
                    >
                      <img
                        src={it.dataUrl || it.url}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={async (e) => {
                          const obj = await ensurePreview(it);
                          if (obj) {
                            const img = e.currentTarget;
                            img.src = obj;
                          }
                        }}
                      />
                    </button>
                    {/* Delete button (appears on hover) */}
                    <button 
                      onClick={() => deleteItem(it.filename)}
                      className="absolute top-1 right-1 p-1 bg-black/60 rounded-full opacity-0 group-hover/item:opacity-100 transition-opacity duration-200 hover:bg-red-500/80"
                      title="Delete"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default History;
