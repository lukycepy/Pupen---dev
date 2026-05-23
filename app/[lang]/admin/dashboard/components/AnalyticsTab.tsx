'use client';

import React from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp, Users, Eye, Calendar, History, User, Activity, Clock, UserPlus } from 'lucide-react';
import { SkeletonTabContent } from '@/app/[lang]/components/Skeleton';
import InlinePulse from '@/app/components/InlinePulse';
import { useDictionary, useLang } from '@/app/context/DictionaryContext';

export default function AnalyticsTab() {
  const dict = useDictionary();
  const lang = useLang();
  const t = dict.admin.analytics;
  const locale = ({ cs: 'cs-CZ', en: 'en-US' } as const)[lang];

  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ['admin_analytics'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token || null;
      if (!token) throw new Error(t.errors.unauthorized);
      const res = await fetch('/api/admin/analytics', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || t.errors.generic);
      return json;
    }
  });

  if (isLoading) return <SkeletonTabContent />;
  if (isError) {
    return (
      <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm dark:bg-stone-950 dark:border-stone-800">
        <div className="flex items-center gap-3 text-stone-700 font-bold dark:text-stone-200">
          <InlinePulse className="bg-stone-300 dark:bg-stone-700" size={16} />
          {t.loadFailed}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
        {[
          { label: t.cards.topViews, value: stats?.totalViews, icon: Eye, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/40' },
          { label: t.cards.confirmedAttendance, value: stats?.totalRSVPs, icon: Users, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950/40' },
          { label: t.cards.pendingApplications, value: stats?.pendingApplications, icon: UserPlus, color: 'text-amber-700 dark:text-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/40' },
          { label: t.cards.activity30d, value: stats?.recentActivity, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/40' },
          { label: t.cards.topEvent, value: stats?.topEvents[0]?.title || t.fallbackDash, icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/40' },
        ].map((stat, idx) => (
          <div key={idx} className="bg-white p-6 rounded-[2.5rem] border shadow-sm flex items-center gap-4 dark:bg-stone-950 dark:border-stone-800">
            <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center shadow-inner`}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1 dark:text-stone-500">{stat.label}</p>
              <p className="text-xl font-black text-stone-900 truncate max-w-[150px] dark:text-stone-100">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* TOP EVENTS CHART */}
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm dark:bg-stone-950 dark:border-stone-800">
          <h3 className="text-lg font-bold mb-8 flex items-center gap-2 dark:text-stone-100">
            <BarChart3 className="text-green-600" />
            {t.topEventsTitle}
          </h3>
          <div className="space-y-6">
            {stats?.topEvents.map((ev: any) => {
              const maxViews = stats.topEvents[0].views || 1;
              const percent = Math.round((ev.views / maxViews) * 100);
              return (
                <div key={ev.id} className="space-y-2">
                  <div className="flex justify-between text-xs font-bold text-stone-600 dark:text-stone-300">
                    <span className="truncate max-w-[200px]">{ev.title}</span>
                    <span>
                      {ev.views} {t.viewsUnit}
                    </span>
                  </div>
                  <div className="h-3 bg-stone-50 rounded-full overflow-hidden border border-stone-100 shadow-inner dark:bg-stone-900/60 dark:border-stone-800">
                    <div 
                      className="h-full bg-green-500 rounded-full transition-all duration-1000" 
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* TOP POSTS CHART */}
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm dark:bg-stone-950 dark:border-stone-800">
          <h3 className="text-lg font-bold mb-8 flex items-center gap-2 dark:text-stone-100">
            <TrendingUp className="text-blue-600" />
            {t.topPostsTitle}
          </h3>
          <div className="space-y-6">
            {stats?.topPosts.map((p: any) => {
              const maxViews = stats.topPosts[0].views || 1;
              const percent = Math.round((p.views / maxViews) * 100);
              return (
                <div key={p.id} className="space-y-2">
                  <div className="flex justify-between text-xs font-bold text-stone-600 dark:text-stone-300">
                    <span className="truncate max-w-[200px]">{p.title}</span>
                    <span>
                      {p.views} {t.viewsUnit}
                    </span>
                  </div>
                  <div className="h-3 bg-stone-50 rounded-full overflow-hidden border border-stone-100 shadow-inner dark:bg-stone-900/60 dark:border-stone-800">
                    <div 
                      className="h-full bg-blue-500 rounded-full transition-all duration-1000" 
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm dark:bg-stone-950 dark:border-stone-800">
        <h3 className="text-lg font-bold mb-8 flex items-center gap-2 dark:text-stone-100">
          <History className="text-green-600" />
          {t.recentAdminsTitle}
        </h3>

        <div className="space-y-3">
          {stats?.recentLogs?.length ? (
            stats.recentLogs.map((log: any) => (
              <div
                key={log.id}
                className="flex items-start gap-4 p-4 bg-stone-50 rounded-2xl border border-stone-100 dark:bg-stone-900/60 dark:border-stone-800"
              >
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-green-600 shrink-0 shadow-sm font-black uppercase text-xs dark:bg-stone-950 dark:border dark:border-stone-800">
                  {log.admin_name?.[0] || log.admin_email?.[0] || '?'}
                </div>
                <div className="flex-grow">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-stone-400 dark:text-stone-500" />
                      <span className="text-sm font-bold text-stone-700 dark:text-stone-200">
                        {log.admin_name || log.admin_email || t.adminFallback}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-stone-300 dark:text-stone-600">
                      <Clock size={12} />
                      {log.created_at ? new Date(log.created_at).toLocaleString(locale) : t.fallbackDash}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs font-bold text-stone-600 dark:text-stone-300">
                    <Activity size={14} className="text-green-600" />
                    <span>{log.action}</span>
                    {log.target_id && (
                      <span className="text-[10px] font-black uppercase tracking-widest text-stone-300 dark:text-stone-600">
                        #{log.target_id}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center py-10 text-stone-400 font-bold uppercase tracking-widest text-xs dark:text-stone-500">
              {t.noActivity}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
