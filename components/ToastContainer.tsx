import React, { useEffect, useState } from 'react';
import { toastService, Toast } from '../services/toastService';

const ToastItem: React.FC<{ t: Toast }> = ({ t }) => {
  const bg = t.type === 'success' ? 'bg-green-600' : t.type === 'error' ? 'bg-red-600' : 'bg-gray-700';
  return (
    <div className={`rounded-md px-3 py-2 text-sm text-white shadow ${bg}`}>
      {t.message}
    </div>
  );
};

const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    const unsub = toastService.subscribe((list) => setToasts(list));
    return unsub;
  }, []);

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(t => <ToastItem key={t.id} t={t} />)}
    </div>
  );
};

export default ToastContainer;
