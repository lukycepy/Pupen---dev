'use client';

import React from 'react';
import Panel from '@/app/components/ui/Panel';

export default function MemberPanel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Panel radius="3xl" className={className || ''}>
      {children}
    </Panel>
  );
}
