export type ToastType = 'success' | 'error' | 'info';
export type Toast = { id: string; type: ToastType; message: string };

const makeId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;

class ToastService {
  private toasts: Toast[] = [];
  private listeners: Array<(t: Toast[]) => void> = [];

  subscribe(fn: (t: Toast[]) => void) {
    this.listeners.push(fn);
    fn(this.toasts.slice());
    return () => { this.listeners = this.listeners.filter(l => l !== fn); };
  }

  private emit() {
    this.listeners.forEach(l => { try { l(this.toasts.slice()); } catch(e){} });
  }

  show(type: ToastType, message: string, timeout = 3000) {
    // Skip error toasts for history save failures to reduce UI noise
    if (type === 'error' && message === 'Failed to save image to history') {
      console.debug('Suppressed error toast:', message);
      return '';
    }
    const id = makeId();
    const t: Toast = { id, type, message };
    this.toasts.push(t);
    this.emit();
    if (timeout > 0) {
      setTimeout(() => this.remove(id), timeout);
    }
    return id;
  }

  remove(id: string) {
    const idx = this.toasts.findIndex(x => x.id === id);
    if (idx > -1) {
      this.toasts.splice(idx, 1);
      this.emit();
    }
  }
}

export const toastService = new ToastService();
