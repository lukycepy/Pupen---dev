'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 max-w-md w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 p-4 rounded-2xl shadow-2xl border animate-in slide-in-from-right-10 duration-300 ${
              toast.type === 'success' ? 'bg-white border-green-100 text-green-800' :
              toast.type === 'error' ? 'bg-white border-red-100 text-red-800' :
              toast.type === 'warning' ? 'bg-white border-amber-100 text-amber-800' :
              'bg-white border-stone-100 text-stone-800'
            }`}
          >
            {toast.type === 'success' && <CheckCircle className="text-green-600 shrink-0" size={20} />}
            {toast.type === 'error' && <AlertCircle className="text-red-600 shrink-0" size={20} />}
            {toast.type === 'warning' && <AlertCircle className="text-amber-500 shrink-0" size={20} />}
            {toast.type === 'info' && <Info className="text-blue-600 shrink-0" size={20} />}
            
            <p className="font-bold text-sm flex-grow">{toast.message}</p>
            
            <button 
              onClick={() => removeToast(toast.id)}
              className="p-1 hover:bg-stone-100 rounded-lg transition"
            >
              <X size={16} className="text-stone-400" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
