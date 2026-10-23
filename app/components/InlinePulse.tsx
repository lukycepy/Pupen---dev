'use client';

import React from 'react';

export default function InlinePulse({
  size = 18,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block rounded-full animate-pulse border-2 border-black bg-transparent dark:border-white ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
