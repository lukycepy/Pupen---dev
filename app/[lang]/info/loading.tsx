export default function Loading() {
  return (
    <div className="min-h-screen bg-white px-6 py-10 dark:bg-black">
      <div className="mx-auto max-w-6xl animate-pulse space-y-6">
        <div className="h-10 w-20 rounded-xl border-2 border-black bg-white dark:border-white dark:bg-black" />
        <div className="rounded-[2rem] border-2 border-black bg-white p-8 dark:border-white dark:bg-black md:p-12">
          <div className="h-8 w-40 rounded-xl bg-black/10 dark:bg-white/10" />
          <div className="mt-6 h-14 w-full max-w-3xl rounded-xl bg-black/10 dark:bg-white/10" />
          <div className="mt-4 h-28 w-full max-w-2xl rounded-xl bg-black/10 dark:bg-white/10" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-64 rounded-[2rem] border-2 border-black bg-white dark:border-white dark:bg-black" />
          ))}
        </div>
      </div>
    </div>
  );
}
