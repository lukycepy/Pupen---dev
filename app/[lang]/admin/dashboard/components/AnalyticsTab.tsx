'use client';

import React from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp, Users, Eye, Calendar, History, User, Activity, Clock, UserPlus } from 'lucide-react';
import { SkeletonTabContent } from '@/app/[lang]/components/Skeleton';
import InlinePulse from '@/app/components/InlinePulse';

export default function AnalyticsTab() {
  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ['admin_analytics'],
    queryFn: async () => {
      const [events, posts, rsvps, logsAll, pendingApps] = await Promise.all([
        supabase.from('events').select('id, title, views').order('views', { ascending: false }).limit(5),
        supabase.from('posts').select('id, title, views').order('views', { ascending: false }).limit(5),
        supabase.from('rsvp').select('id, created_at'),
        supabase
          .from('admin_logs')
          .select('id, created_at, admin_email, admin_name, action, target_id')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase.from('applications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);

      if (events.error) throw events.error;
      if (posts.error) throw posts.error;
      if (rsvps.error) throw rsvps.error;
      if (logsAll.error) throw logsAll.error;
      if ((pendingApps as any)?.error) throw (pendingApps as any).error;

      const totalEventViews = events.data?.reduce((acc, curr) => acc + (curr.views || 0), 0) || 0;
      const totalPostViews = posts.data?.reduce((acc, curr) => acc + (curr.views || 0), 0) || 0;
      const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const recentCount =
        logsAll.data?.filter((l: any) => (l.created_at ? new Date(l.created_at).getTime() >= since : false)).length || 0;

      return {
        topEvents: events.data || [],
        topPosts: posts.data || [],
        totalRSVPs: rsvps.data?.length || 0,
        totalViews: totalEventViews + totalPostViews,
        recentActivity: recentCount,
        pendingApplications: Number((pendingApps as any)?.count || 0),
        recentLogs: (logsAll.data || []).slice(0, 8),
      };
    }
  });

  if (isLoading) return <SkeletonTabContent />;
  if (isError) {
    return (
      <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
        <div className="flex items-center gap-3 text-stone-700 font-bold">
          <InlinePulse className="bg-stone-300" size={16} />
          Nepodařilo se načíst analytiky. Zkontrolujte oprávnění/RLS a schema cache.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
        {[
          { label: 'Zobrazení (TOP 5)', value: stats?.totalViews, icon: Eye, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Potvrzená účast', value: stats?.totalRSVPs, icon: Users, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Přihlášky k vyřízení', value: stats?.pendingApplications, icon: UserPlus, color: 'text-amber-700', bg: 'bg-amber-50' },
          { label: 'Aktivita (30 dní)', value: stats?.recentActivity, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Top Akce', value: stats?.topEvents[0]?.title || '---', icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map((stat, idx) => (
          <div key={idx} className="bg-white p-6 rounded-[2.5rem] border shadow-sm flex items-center gap-4">
            <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center shadow-inner`}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">{stat.label}</p>
              <p className="text-xl font-black text-stone-900 truncate max-w-[150px]">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* TOP EVENTS CHART */}
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
          <h3 className="text-lg font-bold mb-8 flex items-center gap-2">
            <BarChart3 className="text-green-600" />
            Nejčtenější akce
          </h3>
          <div className="space-y-6">
            {stats?.topEvents.map((ev: any) => {
              const maxViews = stats.topEvents[0].views || 1;
              const percent = Math.round((ev.views / maxViews) * 100);
              return (
                <div key={ev.id} className="space-y-2">
                  <div className="flex justify-between text-xs font-bold text-stone-600">
                    <span className="truncate max-w-[200px]">{ev.title}</span>
                    <span>{ev.views} zhlédnutí</span>
                  </div>
                  <div className="h-3 bg-stone-50 rounded-full overflow-hidden border border-stone-100 shadow-inner">
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
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
          <h3 className="text-lg font-bold mb-8 flex items-center gap-2">
            <TrendingUp className="text-blue-600" />
            Nejčtenější novinky
          </h3>
          <div className="space-y-6">
            {stats?.topPosts.map((p: any) => {
              const maxViews = stats.topPosts[0].views || 1;
              const percent = Math.round((p.views / maxViews) * 100);
              return (
                <div key={p.id} className="space-y-2">
                  <div className="flex justify-between text-xs font-bold text-stone-600">
                    <span className="truncate max-w-[200px]">{p.title}</span>
                    <span>{p.views} zhlédnutí</span>
                  </div>
                  <div className="h-3 bg-stone-50 rounded-full overflow-hidden border border-stone-100 shadow-inner">
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

      <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
        <h3 className="text-lg font-bold mb-8 flex items-center gap-2">
          <History className="text-green-600" />
          Poslední aktivita adminů
        </h3>

        <div className="space-y-3">
          {stats?.recentLogs?.length ? (
            stats.recentLogs.map((log: any) => (
              <div
                key={log.id}
                className="flex items-start gap-4 p-4 bg-stone-50 rounded-2xl border border-stone-100"
              >
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-green-600 shrink-0 shadow-sm font-black uppercase text-xs">
                  {log.admin_name?.[0] || log.admin_email?.[0] || '?'}
                </div>
                <div className="flex-grow">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-stone-400" />
                      <span className="text-sm font-bold text-stone-700">
                        {log.admin_name || log.admin_email || 'Admin'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-stone-300">
                      <Clock size={12} />
                      {log.created_at ? new Date(log.created_at).toLocaleString('cs-CZ') : '---'}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs font-bold text-stone-600">
                    <Activity size={14} className="text-green-600" />
                    <span>{log.action}</span>
                    {log.target_id && (
                      <span className="text-[10px] font-black uppercase tracking-widest text-stone-300">
                        #{log.target_id}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center py-10 text-stone-400 font-bold uppercase tracking-widest text-xs">
              Zatím žádná aktivita.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
