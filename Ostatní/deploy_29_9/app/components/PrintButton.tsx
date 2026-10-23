'use client';

import React from 'react';

export default function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex items-center gap-2 bg-stone-900 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-stone-800 transition"
    >
      {label}
    </button>
  );
}

