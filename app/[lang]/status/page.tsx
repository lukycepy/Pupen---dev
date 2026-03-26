import React from 'react';
import { Activity, CheckCircle, Database, Server, Globe } from 'lucide-react';

export const revalidate = 0;

export default async function StatusPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const isEn = lang === 'en';
  
  // Basic health check
  let dbStatus = 'ok';
  let apiStatus = 'ok';
  
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/health`, { cache: 'no-store' });
    if (!res.ok) {
      dbStatus = 'error';
      apiStatus = 'error';
    }
  } catch (e) {
    apiStatus = 'error';
    dbStatus = 'error';
  }

  const allOk = dbStatus === 'ok' && apiStatus === 'ok';

  return (
    <div className="min-h-screen bg-stone-50 py-20 px-4">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <div className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center shadow-xl ${allOk ? 'bg-green-500' : 'bg-amber-500'}`}>
            <Activity className="text-white" size={40} />
          </div>
          <h1 className="text-4xl font-black text-stone-900 tracking-tight">{isEn ? 'System status' : 'Stav systému'}</h1>
          <p className="text-stone-500 font-medium">
            {allOk
              ? (isEn ? 'All systems are operational.' : 'Všechny systémy jsou v provozu.')
              : (isEn ? 'Some systems may be experiencing issues.' : 'Některé systémy mohou mít výpadky.')}
          </p>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-stone-100 p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-stone-400">
                <Globe size={24} />
              </div>
              <div>
                <h3 className="font-bold text-stone-900">{isEn ? 'Web application' : 'Web aplikace'}</h3>
                <p className="text-xs font-black uppercase tracking-widest text-stone-400">{isEn ? 'Frontend' : 'Frontend'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-green-600 bg-green-50 px-4 py-2 rounded-xl">
              <CheckCircle size={18} />
              <span className="font-bold text-sm uppercase tracking-widest">{isEn ? 'Operational' : 'V provozu'}</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-stone-400">
                <Server size={24} />
              </div>
              <div>
                <h3 className="font-bold text-stone-900">{isEn ? 'API services' : 'API služby'}</h3>
                <p className="text-xs font-black uppercase tracking-widest text-stone-400">{isEn ? 'Backend API' : 'Backend API'}</p>
              </div>
            </div>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${apiStatus === 'ok' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
              {apiStatus === 'ok' ? <CheckCircle size={18} /> : <Activity size={18} />}
              <span className="font-bold text-sm uppercase tracking-widest">
                {apiStatus === 'ok' ? (isEn ? 'Operational' : 'V provozu') : (isEn ? 'Degraded' : 'Omezený provoz')}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-stone-400">
                <Database size={24} />
              </div>
              <div>
                <h3 className="font-bold text-stone-900">{isEn ? 'Database' : 'Databáze'}</h3>
                <p className="text-xs font-black uppercase tracking-widest text-stone-400">Supabase</p>
              </div>
            </div>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${dbStatus === 'ok' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
              {dbStatus === 'ok' ? <CheckCircle size={18} /> : <Activity size={18} />}
              <span className="font-bold text-sm uppercase tracking-widest">
                {dbStatus === 'ok' ? (isEn ? 'Operational' : 'V provozu') : (isEn ? 'Degraded' : 'Omezený provoz')}
              </span>
            </div>
          </div>
        </div>

        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-widest text-stone-400">
            {isEn ? 'Last check' : 'Poslední kontrola'}: {new Date().toLocaleString(isEn ? 'en-GB' : 'cs-CZ')}
          </p>
        </div>
      </div>
    </div>
  );
}
