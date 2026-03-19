'use client';

import React from 'react';

interface SkeletonProps {
  className?: string;
}

export default function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`animate-pulse bg-stone-100 rounded-2xl ${className}`} />
  );
}

export function SkeletonTabContent() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-6 rounded-[2rem] border shadow-sm">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-32" />
      </div>
      
      <div className="grid gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white p-8 rounded-[2.5rem] border shadow-sm flex items-center gap-6">
            <Skeleton className="h-20 w-20 rounded-3xl" />
            <div className="flex-grow space-y-3">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/4" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-12 w-12" />
              <Skeleton className="h-12 w-12" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white p-8 rounded-[3rem] shadow-xl border border-stone-50 space-y-6">
          <Skeleton className="h-6 w-24 rounded-full" />
          <div className="space-y-3">
            <Skeleton className="h-8 w-full rounded-xl" />
            <Skeleton className="h-8 w-3/4 rounded-xl" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full rounded-lg" />
            <Skeleton className="h-4 w-full rounded-lg" />
            <Skeleton className="h-4 w-2/3 rounded-lg" />
          </div>
          <Skeleton className="h-4 w-24 rounded-lg pt-4" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-12">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white p-8 md:p-12 rounded-[4rem] shadow-xl border border-stone-50 space-y-8">
          <div className="flex gap-4">
            <Skeleton className="h-6 w-32 rounded-full" />
            <Skeleton className="h-6 w-32 rounded-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-12 w-3/4 rounded-2xl" />
            <Skeleton className="h-12 w-1/2 rounded-2xl" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-4 w-full rounded-lg" />
            <Skeleton className="h-4 w-full rounded-lg" />
            <Skeleton className="h-4 w-full rounded-lg" />
            <Skeleton className="h-4 w-2/3 rounded-lg" />
          </div>
          <Skeleton className="h-8 w-40 rounded-xl" />
        </div>
      ))}
    </div>
  );
}


