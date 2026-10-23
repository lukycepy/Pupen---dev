'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import EmptyState from '@/app/components/ui/EmptyState';

export default function AdminEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return <EmptyState icon={Icon} title={title} description={description} action={action} />;
}
