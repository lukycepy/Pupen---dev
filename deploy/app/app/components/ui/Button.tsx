'use client';

import React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  const base =
    'inline-flex items-center justify-center gap-2 font-bold transition disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes: Record<Size, string> = {
    sm: 'px-4 py-2 rounded-xl text-xs',
    md: 'px-5 py-3 rounded-2xl text-sm',
    lg: 'px-6 py-4 rounded-2xl text-base',
  };
  const variants: Record<Variant, string> = {
    primary: 'bg-stone-900 text-white hover:bg-stone-800 shadow-sm',
    secondary: 'bg-white text-stone-700 hover:bg-stone-50 border border-stone-200',
    ghost: 'bg-transparent text-stone-700 hover:bg-stone-100',
    danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
  };

  return (
    <button
      {...props}
      className={[base, sizes[size], variants[variant], className].filter(Boolean).join(' ')}
    >
      {children}
    </button>
  );
}

