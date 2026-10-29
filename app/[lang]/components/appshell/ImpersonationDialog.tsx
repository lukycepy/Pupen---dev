'use client';

import React from 'react';
import { Shield, Search, UserRound, ArrowRightLeft, Loader2 } from 'lucide-react';
import Dialog from '@/app/components/ui/Dialog';
import InlinePulse from '@/app/components/InlinePulse';
import { useToast } from '@/app/context/ToastContext';
import { supabase } from '@/lib/supabase';
import { writeImpersonationState } from '@/lib/impersonation-client';

type SearchUser = {
  id?: string | null;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  is_member?: boolean | null;
  is_admin?: boolean | null;
};

export default function ImpersonationDialog({
  open,
  onClose,
  lang,
  currentEmail,
}: {
  open: boolean;
  onClose: () => void;
  lang: 'cs' | 'en';
  currentEmail?: string | null;
}) {
  const isEn = lang === 'en';
  const { showToast } = useToast();
  const [query, setQuery] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [submittingId, setSubmittingId] = React.useState('');
  const [users, setUsers] = React.useState<SearchUser[]>([]);

  React.useEffect(() => {
    if (!open) {
      setQuery('');
      setUsers([]);
      setLoading(false);
      setSubmittingId('');
      return;
    }

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setUsers([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error(isEn ? 'Unauthorized' : 'Nejste přihlášený.');

        const res = await fetch(`/api/admin/users/search?query=${encodeURIComponent(trimmed)}&limit=12`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(String(json?.error || (isEn ? 'Search failed' : 'Vyhledávání selhalo')));
        if (!cancelled) {
          setUsers(Array.isArray(json?.users) ? (json.users as SearchUser[]) : []);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          showToast(error instanceof Error ? error.message : isEn ? 'Search failed' : 'Vyhledávání selhalo', 'error');
          setUsers([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [open, query, isEn, showToast]);

  const startImpersonation = async (target: SearchUser, destination: 'admin' | 'member') => {
    const targetId = String(target.id || '').trim();
    const targetEmail = String(target.email || '').trim().toLowerCase();
    if (!targetId || !targetEmail) {
      showToast(isEn ? 'Missing user' : 'Chybí uživatel', 'error');
      return;
    }

    setSubmittingId(`${targetId}:${destination}`);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error(isEn ? 'Unauthorized' : 'Nejste přihlášený.');

      const res = await fetch('/api/admin/impersonation', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetUserId: targetId,
          lang,
          destination,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(json?.error || (isEn ? 'Impersonation failed' : 'Převzetí identity selhalo')));

      const impersonateUrl = String(json?.impersonateUrl || '').trim();
      const restoreUrl = String(json?.restoreUrl || '').trim();
      const originalEmail = String(json?.originalEmail || currentEmail || '').trim().toLowerCase();
      if (!impersonateUrl || !restoreUrl || !originalEmail) {
        throw new Error(isEn ? 'Missing impersonation link' : 'Chybí odkaz pro převzetí identity');
      }

      writeImpersonationState({
        originalEmail,
        targetEmail,
        targetUserId: targetId,
        restoreUrl,
        startedAt: new Date().toISOString(),
        destination,
      });

      window.location.assign(impersonateUrl);
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : isEn ? 'Impersonation failed' : 'Převzetí identity selhalo', 'error');
      setSubmittingId('');
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      overlayClassName="fixed inset-0 bg-black/50 dark:bg-black/70 z-[10000] flex items-center justify-center p-6 animate-in fade-in duration-300 text-left"
      panelClassName="bg-white dark:bg-black w-full max-w-4xl rounded-[2.5rem] border-2 border-black dark:border-white overflow-hidden"
    >
      <div className="border-b-2 border-black px-8 py-6 dark:border-white">
        <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 dark:text-stone-500">
          {isEn ? 'Superadmin' : 'Superadmin'}
        </div>
        <h2 className="text-2xl font-black text-black dark:text-white">
          {isEn ? 'Sign in as another user' : 'Přihlásit se jako jiný uživatel'}
        </h2>
        <p className="mt-2 text-sm font-bold text-stone-500 dark:text-stone-400">
          {isEn
            ? 'This will create a real session for the selected user. A secure return link to your original account will be stored locally.'
            : 'Tímto se vytvoří skutečná session zvoleného uživatele. Bezpečný návratový odkaz na Váš původní účet se uloží lokálně do prohlížeče.'}
        </p>
      </div>

      <div className="space-y-6 p-8">
        <label className="relative block">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-black dark:text-white" size={18} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isEn ? 'Search by name or e-mail' : 'Vyhledat podle jména nebo e-mailu'}
            className="w-full rounded-2xl border-2 border-black bg-white py-4 pl-12 pr-4 font-bold text-black outline-none transition focus:ring-2 focus:ring-green-500 dark:border-white dark:bg-black dark:text-white"
          />
        </label>

        <div className="rounded-[2rem] border-2 border-black bg-white dark:border-white dark:bg-black">
          {loading ? (
            <div className="flex items-center gap-3 px-6 py-8 font-bold text-black dark:text-white">
              <InlinePulse className="bg-green-500 dark:bg-green-400" size={18} />
              {isEn ? 'Searching users…' : 'Hledám uživatele…'}
            </div>
          ) : users.length === 0 ? (
            <div className="px-6 py-8 text-sm font-bold text-stone-500 dark:text-stone-400">
              {query.trim().length < 2
                ? isEn
                  ? 'Type at least 2 characters.'
                  : 'Napište alespoň 2 znaky.'
                : isEn
                  ? 'No matching users found.'
                  : 'Nenašel jsem žádného odpovídajícího uživatele.'}
            </div>
          ) : (
            <div className="divide-y-2 divide-black/10 dark:divide-white/10">
              {users.map((user) => {
                const id = String(user.id || '');
                const email = String(user.email || '').trim();
                const name = `${String(user.first_name || '').trim()} ${String(user.last_name || '').trim()}`.trim() || email || '—';
                const memberBadge = !!user.is_member;
                const adminBadge = !!user.is_admin;
                return (
                  <div key={id} className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-black text-black dark:text-white">{name}</div>
                        {adminBadge ? (
                          <span className="rounded-full border-2 border-red-600 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-red-700 dark:border-red-500 dark:text-red-400">
                            Admin
                          </span>
                        ) : null}
                        {memberBadge ? (
                          <span className="rounded-full border-2 border-green-600 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-green-700 dark:border-green-500 dark:text-green-400">
                            {isEn ? 'Member' : 'Člen'}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-sm font-bold text-stone-500 dark:text-stone-400">{email || '—'}</div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => startImpersonation(user, 'member')}
                        disabled={!!submittingId}
                        className="inline-flex items-center gap-2 rounded-2xl border-2 border-green-700 bg-green-600 px-4 py-3 text-sm font-black text-white transition hover:bg-green-700 disabled:opacity-50 dark:border-green-500 dark:bg-green-500 dark:text-black dark:hover:bg-green-400"
                      >
                        {submittingId === `${id}:member` ? <Loader2 size={16} className="animate-spin" /> : <UserRound size={16} />}
                        {isEn ? 'Open as member' : 'Otevřít jako člen'}
                      </button>
                      <button
                        type="button"
                        onClick={() => startImpersonation(user, 'admin')}
                        disabled={!!submittingId}
                        className="inline-flex items-center gap-2 rounded-2xl border-2 border-black bg-white px-4 py-3 text-sm font-black text-black transition hover:border-green-600 hover:bg-green-50 hover:text-green-600 disabled:opacity-50 dark:border-white dark:bg-black dark:text-white dark:hover:border-green-500 dark:hover:bg-green-950 dark:hover:text-green-500"
                      >
                        {submittingId === `${id}:admin` ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
                        {isEn ? 'Open as admin' : 'Otevřít jako admin'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-2xl border-2 border-black bg-white px-5 py-3 font-black text-black transition hover:border-green-600 hover:bg-green-50 hover:text-green-600 dark:border-white dark:bg-black dark:text-white dark:hover:border-green-500 dark:hover:bg-green-950 dark:hover:text-green-500"
          >
            <ArrowRightLeft size={16} />
            {isEn ? 'Close' : 'Zavřít'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
