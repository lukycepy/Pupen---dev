'use client';

import React from 'react';
import Panel from '@/app/components/ui/Panel';

export default function AdminPanel({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Panel radius="2xl" className={className}>
      {children}
    </Panel>
  );
}
