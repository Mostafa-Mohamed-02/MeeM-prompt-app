import { HistoryItem, HistoryState } from '../types';
import { toastService } from './toastService';

// Simple id generator (no external deps)
const makeId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;

const INPUTS_SERVER_BASE = (typeof window !== 'undefined' && (window as any).INPUTS_SERVER_BASE) || 'http://localhost:4002';

class HistoryService {
  private historyState: HistoryState = {
    items: [],
    selectedItemId: null
  };
  private listeners: Array<() => void> = [];
  // track background save state to avoid duplicate attempts/toasts
  private pendingSaves: Set<string> = new Set();
  private failedSaves: Set<string> = new Set();
  private succeededSaves: Set<string> = new Set();

  constructor() {
    this.loadHistoryFromServer();
  }

  private findExistingIndex(fileName?: string, dataUrl?: string, hash?: string) {
    if (!fileName && !dataUrl && !hash) return -1;
    return this.historyState.items.findIndex(i => {
      // prefer hash match when available
      if (hash && i.hash && i.hash === hash) return true;
      if (fileName && i.fileName && i.fileName === fileName) return true;
      if (dataUrl && i.dataUrl && i.dataUrl === dataUrl) return true;
      return false;
    });
  }

  private async computeHashFromDataUrl(dataUrl: string): Promise<string> {
    try {
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return '';
      const b64 = match[2];
      const binary = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const hashBuffer = await crypto.subtle.digest('SHA-1', binary);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      console.error('hash compute failed', e);
      return '';
    }
  }

  private async loadHistoryFromServer() {
    try {
      const res = await fetch(`${INPUTS_SERVER_BASE}/list`);
      if (!res.ok) return;
      const files: Array<{ filename: string }> = await res.json();

      const serverItems: HistoryItem[] = await Promise.all(
        files.map(async (f) => {
          const fileUrl = `${INPUTS_SERVER_BASE}/files/${encodeURIComponent(f.filename)}`;
          const dataUrl = await this.loadImageAsDataUrl(fileUrl);
          const hash = dataUrl ? await this.computeHashFromDataUrl(dataUrl) : '';
          return {
            id: makeId(),
            timestamp: Date.now(),
            fileName: f.filename,
            filePath: fileUrl,
            dataUrl,
            hash
          } as HistoryItem;
        })
      );

      // Merge server items with any existing local items (avoid duplicates)
      // Prefer hash when available to dedupe reliably across different filenames/dataUrls
      const map = new Map<string, HistoryItem>();
      serverItems.forEach(it => {
        const key = it.hash || it.fileName || it.dataUrl;
        if (key) map.set(key, it);
      });
      // include local persisted items that are not duplicates
      try {
        const raw = localStorage.getItem('history_items');
        if (raw) {
          const local: HistoryItem[] = JSON.parse(raw);
          for (const it of local) {
            if (!it.hash && it.dataUrl) {
              try { it.hash = await this.computeHashFromDataUrl(it.dataUrl); } catch(e){}
            }
            const key = it.hash || it.fileName || it.dataUrl;
            if (key && !map.has(key)) map.set(key, it);
          }
        }
      } catch (e) {}

      this.historyState.items = Array.from(map.values());
      // persist the merged list
      try { localStorage.setItem('history_items', JSON.stringify(this.historyState.items)); } catch(e){}
    } catch (err) {
      console.error('Failed to load history from inputs server', err);
      // try loading from localStorage fallback
      try {
        const raw = localStorage.getItem('history_items');
        if (raw) this.historyState.items = JSON.parse(raw);
      } catch(e){}
    }
  }

  private async loadImageAsDataUrl(url: string): Promise<string> {
    try {
      const res = await fetch(url);
      if (!res.ok) return '';
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.error('Failed to load image as data url', err);
      return '';
    }
  }

  async saveImage(file: File): Promise<HistoryItem | null> {
    let dataUrl = '';
    try {
      // read file as dataURL
      dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // POST to inputs server /save
      const payload = { dataUrl, filename: file.name };
      const res = await fetch(`${INPUTS_SERVER_BASE}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        console.error('Inputs server returned error saving image');
        return null;
      }

      const body = await res.json();
      const storedFilename = body.filename;
      const fileUrl = `${INPUTS_SERVER_BASE}/files/${encodeURIComponent(storedFilename)}`;

      const hash = dataUrl ? await this.computeHashFromDataUrl(dataUrl) : '';
      const historyItem: HistoryItem = {
        id: makeId(),
        timestamp: Date.now(),
        fileName: storedFilename,
        filePath: fileUrl,
        dataUrl,
        hash
      };

      // dedupe: if exists, update and move to front; otherwise add
      const existing = this.findExistingIndex(storedFilename, dataUrl, hash);
      if (existing > -1) {
        this.historyState.items.splice(existing, 1);
      }
      this.historyState.items.unshift(historyItem);
      try { localStorage.setItem('history_items', JSON.stringify(this.historyState.items)); } catch(e){}
      this.emit();
      return historyItem;
    } catch (err) {
      console.error('Failed to save image to inputs server', err);
      // fallback: save locally to localStorage
      try {
        const hash = dataUrl ? await this.computeHashFromDataUrl(dataUrl) : '';
        const historyItem: HistoryItem = {
          id: makeId(),
          timestamp: Date.now(),
          fileName: file.name,
          filePath: '',
          dataUrl,
          hash
        };
        const existing = this.findExistingIndex(file.name, dataUrl, hash);
        if (existing > -1) {
          this.historyState.items.splice(existing, 1);
        }
        this.historyState.items.unshift(historyItem);
        try { localStorage.setItem('history_items', JSON.stringify(this.historyState.items)); } catch(e){}
        this.emit();
        return historyItem;
      } catch (e) {
        return null;
      }
    }
  }

  // Non-blocking save: immediately add to history and save in background
  async saveImageBackground(file: File): Promise<HistoryItem> {
    // read file as dataURL quickly
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const hash = dataUrl ? await this.computeHashFromDataUrl(dataUrl) : '';
    const historyItem: HistoryItem = {
      id: makeId(),
      timestamp: Date.now(),
      fileName: file.name,
      filePath: '',
      dataUrl,
      hash
    };

    // If an identical item already exists (by hash/fileName/dataUrl), remove it first
    const existingQuick = this.findExistingIndex(file.name, dataUrl, hash);
    if (existingQuick > -1) this.historyState.items.splice(existingQuick, 1);

    this.historyState.items.unshift(historyItem);
    try { localStorage.setItem('history_items', JSON.stringify(this.historyState.items)); } catch(e){}
    this.emit();

    // attempt to save to server but don't await external callers; avoid duplicate background attempts
    (async () => {
      const key = hash || file.name || dataUrl;
      if (this.pendingSaves.has(key) || this.succeededSaves.has(key)) return;
      this.pendingSaves.add(key);
      try {
        const res = await fetch(`${INPUTS_SERVER_BASE}/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl, filename: file.name })
        });
        if (res.ok) {
          const body = await res.json();
          const storedFilename = body.filename;
          const fileUrl = `${INPUTS_SERVER_BASE}/files/${encodeURIComponent(storedFilename)}`;
          // dedupe: if an item exists with this filename or hash/dataUrl, update it; otherwise update current
          const existing = this.findExistingIndex(storedFilename, dataUrl, hash);
          if (existing > -1) {
            this.historyState.items[existing].fileName = storedFilename;
            this.historyState.items[existing].filePath = fileUrl;
            // move to front
            const item = this.historyState.items.splice(existing, 1)[0];
            this.historyState.items.unshift(item);
          } else {
            const idx = this.historyState.items.findIndex(i => i.id === historyItem.id);
            if (idx > -1) {
              this.historyState.items[idx].fileName = storedFilename;
              this.historyState.items[idx].filePath = fileUrl;
            }
          }
          try { localStorage.setItem('history_items', JSON.stringify(this.historyState.items)); } catch(e){}
          this.emit();
          this.succeededSaves.add(key);
          this.pendingSaves.delete(key);
          this.failedSaves.delete(key);  // Clear any previous failure state
          try { toastService.show('success', 'Saved image to history'); } catch(e){}
        } else {
          this.pendingSaves.delete(key);
          if (!this.failedSaves.has(key)) {
            this.failedSaves.add(key);
            // Log error to console but don't show toast
            console.debug('Failed to save image to history');
          }
        }
      } catch (e) {
        console.debug('background save failed', e);
        this.pendingSaves.delete(key);
        if (!this.failedSaves.has(key)) {
          this.failedSaves.add(key);
          // Log error to console but don't show error toast
          console.debug('Failed to save image to history');
        }
      }
    })();

    return historyItem;
  }

  // Save directly from a dataUrl (useful for cropped/generated images without a File object)
  async saveDataUrlBackground(dataUrl: string, filename?: string): Promise<HistoryItem> {
    const hash = dataUrl ? await this.computeHashFromDataUrl(dataUrl) : '';
    const historyItem: HistoryItem = {
      id: makeId(),
      timestamp: Date.now(),
      fileName: filename || `image-${Date.now()}.png`,
      filePath: '',
      dataUrl,
      hash
    };

    // dedupe by hash/filename/dataUrl
    const existingQuick = this.findExistingIndex(historyItem.fileName, dataUrl, hash);
    if (existingQuick > -1) this.historyState.items.splice(existingQuick, 1);

    this.historyState.items.unshift(historyItem);
    try { localStorage.setItem('history_items', JSON.stringify(this.historyState.items)); } catch(e){}
    this.emit();

    // attempt to save to server but don't await external callers
    (async () => {
      const key = hash || historyItem.fileName || dataUrl;
      if (this.pendingSaves.has(key) || this.succeededSaves.has(key)) return;
      this.pendingSaves.add(key);
      try {
        const res = await fetch(`${INPUTS_SERVER_BASE}/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl, filename: historyItem.fileName })
        });
        if (res.ok) {
          const body = await res.json();
          const storedFilename = body.filename;
          const fileUrl = `${INPUTS_SERVER_BASE}/files/${encodeURIComponent(storedFilename)}`;
          const existing = this.findExistingIndex(storedFilename, dataUrl, hash);
          if (existing > -1) {
            this.historyState.items[existing].fileName = storedFilename;
            this.historyState.items[existing].filePath = fileUrl;
            const item = this.historyState.items.splice(existing, 1)[0];
            this.historyState.items.unshift(item);
          } else {
            const idx = this.historyState.items.findIndex(i => i.id === historyItem.id);
            if (idx > -1) {
              this.historyState.items[idx].fileName = storedFilename;
              this.historyState.items[idx].filePath = fileUrl;
            }
          }
          try { localStorage.setItem('history_items', JSON.stringify(this.historyState.items)); } catch(e){}
          this.emit();
          this.succeededSaves.add(key);
          this.pendingSaves.delete(key);
          this.failedSaves.delete(key);  // Clear any previous failure state
          try { toastService.show('success', 'Saved image to history'); } catch(e){}
        } else {
          this.pendingSaves.delete(key);
          if (!this.failedSaves.has(key)) {
            this.failedSaves.add(key);
            // Log error to console but don't show toast
            console.debug('Failed to save image to history');
          }
        }
      } catch (e) {
        console.debug('background save failed', e);
        this.pendingSaves.delete(key);
        if (!this.failedSaves.has(key)) {
          this.failedSaves.add(key);
          // Log error to console but don't show error toast
          console.debug('Failed to save image to history');
        }
      }
    })();

    return historyItem;
  }

  getHistory(): HistoryState {
    return this.historyState;
  }

  setSelectedItem(itemId: string | null) {
    this.historyState.selectedItemId = itemId;
  }

  updateItemMetadata(itemId: string, metadata: HistoryItem['metadata']) {
    const item = this.historyState.items.find(item => item.id === itemId);
    if (item) item.metadata = metadata;
  }

  deleteItem(itemId: string) {
    const idx = this.historyState.items.findIndex(i => i.id === itemId);
    if (idx === -1) return;
    // NOTE: inputs-server does not currently provide a delete endpoint.
    // We remove from local state; server file will remain unless server side delete is implemented.
    this.historyState.items.splice(idx, 1);
    if (this.historyState.selectedItemId === itemId) this.historyState.selectedItemId = null;
    try { localStorage.setItem('history_items', JSON.stringify(this.historyState.items)); } catch(e){}
    this.emit();
  }

  clearAll() {
    this.historyState.items = [];
    this.historyState.selectedItemId = null;
    try { localStorage.removeItem('history_items'); } catch(e){}
    this.emit();
  }

  subscribe(fn: () => void) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter(l => l !== fn); };
  }

  private emit() {
    this.listeners.forEach(fn => { try { fn(); } catch(e){} });
  }
}

export const historyService = new HistoryService();