import React from 'react';

function Shimmer({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-3xl bg-stone-200/80 dark:bg-stone-800/80 ${className}`} />;
}

export function PublicPageLoading() {
  return (
    <div className="min-h-[70vh] bg-stone-50 px-6 py-10 dark:bg-stone-950">
      <div className="mx-auto max-w-7xl space-y-8">
        <Shimmer className="h-[48vh] w-full rounded-[2.5rem]" />
        <div className="-mt-14 grid gap-5 md:grid-cols-3">
          <Shimmer className="h-44 w-full" />
          <Shimmer className="h-44 w-full" />
          <Shimmer className="h-44 w-full" />
        </div>
        <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
          <Shimmer className="h-80 w-full" />
          <div className="space-y-6">
            <Shimmer className="h-36 w-full" />
            <Shimmer className="h-36 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function CenteredCardLoading() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl rounded-[2.5rem] border border-stone-200 bg-white p-8 shadow-sm dark:border-stone-800 dark:bg-stone-900">
        <div className="mx-auto mb-8 h-16 w-16 animate-pulse rounded-[1.75rem] bg-stone-200 dark:bg-stone-800" />
        <div className="space-y-4">
          <Shimmer className="mx-auto h-4 w-24 rounded-full" />
          <Shimmer className="mx-auto h-10 w-56 rounded-2xl" />
          <Shimmer className="mx-auto h-5 w-72 rounded-xl" />
        </div>
        <div className="mt-10 space-y-4">
          <Shimmer className="h-14 w-full rounded-2xl" />
          <Shimmer className="h-14 w-full rounded-2xl" />
          <Shimmer className="h-14 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export function ListPageLoading() {
  return (
    <div className="min-h-[70vh] bg-stone-50 px-6 py-10 dark:bg-stone-950">
      <div className="mx-auto max-w-7xl space-y-10">
        <div className="space-y-4">
          <Shimmer className="h-4 w-24 rounded-full" />
          <Shimmer className="h-12 w-80 max-w-full rounded-2xl" />
        </div>
        <div className="flex gap-3 overflow-hidden">
          <Shimmer className="h-12 w-28 rounded-full" />
          <Shimmer className="h-12 w-28 rounded-full" />
          <Shimmer className="h-12 w-28 rounded-full" />
          <Shimmer className="h-12 w-28 rounded-full" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Shimmer className="h-96 w-full" />
          <Shimmer className="h-96 w-full" />
          <Shimmer className="h-96 w-full" />
        </div>
      </div>
    </div>
  );
}

export function MemberAreaLoading() {
  return (
    <div className="min-h-[70vh] bg-stone-50 px-4 py-6 dark:bg-stone-950">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[280px_1fr]">
        <div className="rounded-[2rem] border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <div className="mb-6 flex items-center gap-4">
            <Shimmer className="h-14 w-14 rounded-full" />
            <div className="flex-1 space-y-3">
              <Shimmer className="h-4 w-24 rounded-full" />
              <Shimmer className="h-4 w-32 rounded-full" />
            </div>
          </div>
          <div className="space-y-3">
            <Shimmer className="h-11 w-full rounded-2xl" />
            <Shimmer className="h-11 w-full rounded-2xl" />
            <Shimmer className="h-11 w-full rounded-2xl" />
            <Shimmer className="h-11 w-full rounded-2xl" />
          </div>
        </div>
        <div className="space-y-6">
          <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-900">
            <div className="space-y-4">
              <Shimmer className="h-5 w-32 rounded-full" />
              <Shimmer className="h-12 w-64 rounded-2xl" />
              <Shimmer className="h-4 w-full rounded-full" />
              <Shimmer className="h-4 w-10/12 rounded-full" />
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <Shimmer className="h-44 w-full" />
            <Shimmer className="h-44 w-full" />
            <Shimmer className="h-44 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminDashboardLoading() {
  return (
    <div className="min-h-[70vh] bg-stone-50 px-4 py-6 dark:bg-stone-950">
      <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[290px_1fr]">
        <div className="rounded-[2rem] border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <div className="mb-6 space-y-3">
            <Shimmer className="h-4 w-28 rounded-full" />
            <Shimmer className="h-10 w-40 rounded-2xl" />
          </div>
          <div className="space-y-3">
            <Shimmer className="h-11 w-full rounded-2xl" />
            <Shimmer className="h-11 w-full rounded-2xl" />
            <Shimmer className="h-11 w-full rounded-2xl" />
            <Shimmer className="h-11 w-full rounded-2xl" />
            <Shimmer className="h-11 w-full rounded-2xl" />
          </div>
        </div>
        <div className="space-y-6">
          <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-900">
            <div className="flex flex-wrap gap-3">
              <Shimmer className="h-10 w-32 rounded-full" />
              <Shimmer className="h-10 w-32 rounded-full" />
              <Shimmer className="h-10 w-32 rounded-full" />
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <Shimmer className="h-28 w-full" />
              <Shimmer className="h-28 w-full" />
              <Shimmer className="h-28 w-full" />
            </div>
          </div>
          <Shimmer className="h-[26rem] w-full rounded-[2rem]" />
        </div>
      </div>
    </div>
  );
}
