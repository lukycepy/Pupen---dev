'use client';

import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function CopyButton({
  value,
  copiedLabel,
  idleLabel,
  className = '',
}: {
  value: string;
  copiedLabel?: string;
  idleLabel?: string;
  className?: string;
}) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
      showToast(copiedLabel || 'Zkopírováno', 'success');
    } catch {
      showToast('Kopírování se nezdařilo', 'error');
    }
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest border transition ${className}`}
      aria-label={idleLabel || 'Kopírovat'}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? (copiedLabel || 'Zkopírováno') : (idleLabel || 'Kopírovat')}
    </button>
  );
}
