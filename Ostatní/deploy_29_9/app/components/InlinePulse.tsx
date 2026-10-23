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
      className={`inline-block rounded-full animate-pulse ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
