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
    danger: 'bg-red-600 hover:bg-red-700 text-white shadow-red-900/20',
    warning: 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-900/20',
    info: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-900/20'
  };

  const iconColors = {
    danger: 'text-red-600 bg-red-50',
    warning: 'text-amber-500 bg-amber-50',
    info: 'text-blue-600 bg-blue-50'
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
        <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />

        <div
          ref={panelRef}
          tabIndex={-1}
          className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl border border-stone-100 overflow-hidden animate-in zoom-in slide-in-from-bottom-8 duration-300"
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
                className="p-2 text-stone-300 hover:text-stone-500 hover:bg-stone-50 rounded-xl transition focus:ring-2 focus:ring-stone-500 focus:outline-none"
                aria-label="Zavřít"
              >
                <X size={20} />
              </button>
            </div>

            <h3 id="modal-title" className="text-2xl font-black text-stone-900 mb-3 tracking-tight">
              {title}
            </h3>
            <p id="modal-desc" className="text-stone-500 font-medium leading-relaxed mb-8">
              {message}
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={`flex-grow py-4 px-6 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg hover:scale-[1.02] active:scale-[0.98] focus:ring-2 focus:ring-offset-2 focus:outline-none ${colors[variant]}`}
              >
                {confirmLabel}
              </button>
              <button
                onClick={onClose}
                className="flex-grow py-4 px-6 rounded-2xl font-black uppercase tracking-widest text-xs bg-stone-100 text-stone-500 hover:bg-stone-200 transition-all hover:scale-[1.02] active:scale-[0.98] focus:ring-2 focus:ring-stone-500 focus:outline-none"
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
