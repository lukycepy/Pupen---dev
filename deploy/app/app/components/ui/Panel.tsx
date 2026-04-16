import React from 'react';

type Radius = 'xl' | '2xl' | '3xl';

export default function Panel({
  children,
  className = '',
  radius = '3xl',
  padded = false,
}: {
  children: React.ReactNode;
  className?: string;
  radius?: Radius;
  padded?: boolean;
}) {
  const r = radius === 'xl' ? 'rounded-xl' : radius === '2xl' ? 'rounded-[2rem]' : 'rounded-[3rem]';
  return (
    <div className={['bg-white border border-stone-100 shadow-sm', r, padded ? 'p-8' : '', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}
