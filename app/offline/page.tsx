export const dynamic = 'force-static';

export default function OfflinePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
      <div className="w-full max-w-md bg-white border border-stone-100 rounded-[2.5rem] p-10 text-center shadow-sm">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">Offline</div>
        <h1 className="mt-3 text-2xl font-black text-stone-900">Jste offline</h1>
        <p className="mt-3 text-sm text-stone-600 font-medium">
          Připojte se k internetu a obnovte stránku. Některé části aplikace vyžadují přihlášení a živá data.
        </p>
      </div>
    </main>
  );
}

