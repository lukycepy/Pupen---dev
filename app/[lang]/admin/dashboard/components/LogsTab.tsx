'use client';

import React from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { History, Clock, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { SkeletonTabContent } from '@/app/[lang]/components/Skeleton';

export default function LogsTab() {
  const [q, setQ] = React.useState('');
  const [type, setType] = React.useState<'all' | 'admin' | 'member' | 'system'>('all');
  const [openId, setOpenId] = React.useState<string | null>(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['admin_logs'],
    queryFn: async () => {
      const { data } = await supabase.from('admin_logs').select('*').order('created_at', { ascending: false }).limit(100);
      return data || [];
    }
  });

  if (isLoading) return <SkeletonTabContent />;

  const norm = (s: any) => String(s || '').toLowerCase();
  const qq = norm(q);

  const getActorType = (log: any) => {
    const email = norm(log?.admin_email);
    const name = norm(log?.admin_name);
    if (!email && !name) return 'system';
    if (email.includes('webhook') || name.includes('webhook')) return 'system';
    if (name.includes('emailprefs')) return 'member';
    if (email === 'member') return 'member';
    return 'admin';
  };

  const getBadge = (log: any) => {
    const action = norm(log?.action);
    if (action.startsWith('user_')) return { label: 'Uživatel', cls: 'bg-blue-50 text-blue-700 border-blue-100' };
    if (action.startsWith('site_config')) return { label: 'Web', cls: 'bg-amber-50 text-amber-700 border-amber-100' };
    if (action.startsWith('sos')) return { label: 'SOS', cls: 'bg-red-50 text-red-700 border-red-100' };
    if (action.startsWith('lost_') || action.includes('lost')) return { label: 'Ztráty', cls: 'bg-stone-50 text-stone-700 border-stone-100' };
    if (action.startsWith('fio')) return { label: 'Fio', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
    if (action.startsWith('gdpr')) return { label: 'GDPR', cls: 'bg-purple-50 text-purple-700 border-purple-100' };
    return { label: 'Akce', cls: 'bg-green-50 text-green-700 border-green-100' };
  };

  const filtered = logs.filter((log: any) => {
    const actorType = getActorType(log);
    if (type !== 'all' && actorType !== type) return false;
    if (!qq) return true;
    const hay = [
      log?.admin_email,
      log?.admin_name,
      log?.action,
      log?.target_id,
      JSON.stringify(log?.details || {}),
    ]
      .map(norm)
      .join(' ');
    return hay.includes(qq);
  });

  return (
    <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-3">
        <History className="text-green-600" />
        Historie aktivit (admini i členové)
      </h2>
          <p className="text-xs text-stone-400 font-medium mt-1">Filtruj podle e-mailu, akce nebo target_id. Zobrazuji {filtered.length} / {logs.length}.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Hledat v logách…"
              className="w-full sm:w-[320px] bg-stone-50 border border-stone-100 rounded-2xl pl-11 pr-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            {(['all', 'admin', 'member', 'system'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition ${
                  type === t ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                }`}
              >
                {t === 'all' ? 'Vše' : t === 'admin' ? 'Admini' : t === 'member' ? 'Členové' : 'Systém'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <p className="text-center py-12 text-stone-400 font-bold uppercase tracking-widest text-xs">Zatím žádné záznamy.</p>
        ) : (
          filtered.map((log: any) => {
            const badge = getBadge(log);
            const isOpen = openId === log.id;
            return (
            <div key={log.id} className="p-5 bg-stone-50 rounded-2xl border border-stone-100 transition hover:bg-white hover:shadow-lg">
              <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-green-600 shrink-0 shadow-sm font-black uppercase text-xs">
                {log.admin_name?.[0] || log.admin_email?.[0]}
              </div>
              <div className="flex-grow">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-1 gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-stone-900 text-sm">{log.admin_name || log.admin_email}</span>
                    <span className="text-[10px] text-stone-400 font-medium">({log.admin_email})</span>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full border ${badge.cls}`}>{badge.label}</span>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-stone-300 flex items-center gap-1 shrink-0">
                    <Clock size={10} /> {new Date(log.created_at).toLocaleString('cs-CZ')}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div className="text-sm text-stone-600 font-medium">
                      <span className="text-stone-400 font-black uppercase tracking-widest text-[10px] mr-2">Akce</span>
                      <span className="font-black text-stone-900">{log.action}</span>
                    </div>
                    {log.target_id && (
                      <div className="text-[10px] text-stone-400 font-bold">
                        Target: <span className="font-black text-stone-600">{log.target_id}</span>
                      </div>
                    )}
                  </div>

                  {log.details && (
                    <div className="bg-white rounded-xl border border-stone-100 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setOpenId(isOpen ? null : String(log.id))}
                        className="w-full flex items-center justify-between px-4 py-3 text-[10px] font-black uppercase tracking-widest text-stone-500 hover:bg-stone-50 transition"
                      >
                        <span>Detaily</span>
                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                      {isOpen && (
                        <pre className="px-4 py-3 text-[11px] text-stone-700 whitespace-pre-wrap break-words font-mono border-t border-stone-100">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              </div>
              </div>
            </div>
          );})
        )}
      </div>
    </div>
  );
}
