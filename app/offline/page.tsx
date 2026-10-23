export const dynamic = 'force-static';

export default function OfflinePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-white dark:bg-black text-black dark:text-white p-6">
      <div className="w-full max-w-md bg-white dark:bg-black border-2 border-black dark:border-white rounded-[2.5rem] p-10 text-center">
        <div className="text-[10px] font-black uppercase tracking-[0.2em]">Offline</div>
        <h1 className="mt-3 text-2xl font-black">Jste offline</h1>
        <p className="mt-3 text-sm font-medium">
          Připojte se k internetu a obnovte stránku. Některé části aplikace vyžadují přihlášení a živá data.
        </p>
      </div>
    </main>
  );
}

