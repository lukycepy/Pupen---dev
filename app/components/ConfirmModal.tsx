'use client';

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import Portal from './ui/Portal';
import { useTopLayer } from './ui/topLayer';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Potvrdit',
  cancelLabel = 'Zrušit',
  variant = 'danger'
}: ConfirmModalProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  useTopLayer(isOpen, onClose, panelRef, { closeOnEscape: true, lockScroll: true, initialFocus: 'first' });

  if (!isOpen) return null;

  const colors = {
    danger: 'bg-red-600 hover:bg-red-700 text-white border-2 border-red-700 dark:border-red-500',
    warning: 'bg-amber-500 hover:bg-amber-600 text-white border-2 border-amber-600 dark:border-amber-400',
    info: 'bg-blue-600 hover:bg-blue-700 text-white border-2 border-blue-700 dark:border-blue-500'
  };

  const iconColors = {
    danger: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border-2 border-red-600/20 dark:border-red-400/20',
    warning: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border-2 border-amber-600/20 dark:border-amber-400/20',
    info: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 border-2 border-blue-600/20 dark:border-blue-400/20'
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
        <div className="absolute inset-0 bg-black/50 dark:bg-black/70 animate-in fade-in duration-300" onClick={onClose} />

        <div
          ref={panelRef}
          tabIndex={-1}
          className="relative w-full max-w-md bg-white dark:bg-black rounded-[2.5rem] border-2 border-black dark:border-white overflow-hidden animate-in zoom-in slide-in-from-bottom-8 duration-300"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          aria-describedby="modal-desc"
        >
          <div className="p-8">
            <div className="flex items-start justify-between mb-6">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${iconColors[variant]}`}>
                <AlertTriangle size={28} />
              </div>
              <button
                onClick={onClose}
                className="p-2 bg-white dark:bg-black border-2 border-black dark:border-white text-black dark:text-white hover:bg-green-50 dark:hover:bg-green-950 hover:text-green-600 dark:hover:text-green-500 hover:border-green-600 dark:hover:border-green-500 rounded-xl transition focus:ring-2 focus:ring-green-500 focus:outline-none"
                aria-label="Zavřít"
              >
                <X size={20} />
              </button>
            </div>

            <h3 id="modal-title" className="text-2xl font-black text-black dark:text-white mb-3 tracking-tight">
              {title}
            </h3>
            <p id="modal-desc" className="text-stone-500 dark:text-stone-400 font-medium leading-relaxed mb-8">
              {message}
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={`flex-grow py-4 px-6 rounded-2xl font-black uppercase tracking-widest text-xs transition-all hover:scale-[1.02] active:scale-[0.98] focus:ring-2 focus:ring-offset-2 focus:outline-none ${colors[variant]}`}
              >
                {confirmLabel}
              </button>
              <button
                onClick={onClose}
                className="flex-grow py-4 px-6 rounded-2xl font-black uppercase tracking-widest text-xs bg-white dark:bg-black text-black dark:text-white hover:bg-green-50 dark:hover:bg-green-950 hover:text-green-600 dark:hover:text-green-500 border-2 border-black dark:border-white hover:border-green-600 dark:hover:border-green-500 transition-all hover:scale-[1.02] active:scale-[0.98] focus:ring-2 focus:ring-green-500 focus:outline-none"
              >
                {cancelLabel}
              </button>
            </div>
          </div>

          <div className={`h-2 w-full ${variant === 'danger' ? 'bg-red-600' : variant === 'warning' ? 'bg-amber-500' : 'bg-blue-600'}`} />
        </div>
      </div>
    </Portal>
  );
}
