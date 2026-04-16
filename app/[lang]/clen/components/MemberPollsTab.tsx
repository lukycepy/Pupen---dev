'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import InlinePulse from '@/app/components/InlinePulse';
import { useToast } from '@/app/context/ToastContext';
import { CheckCircle, HelpCircle } from 'lucide-react';
import { useSitePageContent } from '@/app/[lang]/components/useSitePageContent';

export default function MemberPollsTab({ lang }: { lang: string }) {
  const { showToast } = useToast();
  const { title: pageTitle, html: pageHtml } = useSitePageContent('ankety', lang);
  const [poll, setPoll] = useState<any>(null);
  const [voted, setVoted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [votingId, setVotingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error(lang === 'en' ? 'Unauthorized' : 'Nepřihlášen');

      const res = await fetch('/api/polls/active', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      setPoll(json.poll);
      setVoted(!!json.voted);
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setLoading(false);
    }
  }, [lang, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const totalVotes = useMemo(() => {
    if (!poll?.poll_options) return 0;
    return poll.poll_options.reduce((acc: number, o: any) => acc + (o.votes || 0), 0);
  }, [poll?.poll_options]);

  const vote = async (optionId: string) => {
    setVotingId(optionId);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error(lang === 'en' ? 'Unauthorized' : 'Nepřihlášen');

      const res = await fetch('/api/polls/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pollId: poll.id, optionId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      if (json.alreadyVoted) {
        showToast(lang === 'en' ? 'Already voted' : 'Už jste hlasoval/a', 'info');
        setVoted(true);
        await load();
        return;
      }
      setPoll(json.poll);
      setVoted(true);
      showToast(lang === 'en' ? 'Vote recorded' : 'Hlas započítán', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setVotingId(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-10 rounded-[3rem] border border-stone-100 shadow-sm flex items-center justify-center">
        <InlinePulse className="bg-stone-200" size={18} />
      </div>
    );
  }

  if (!poll) {
    return (
      <div className="space-y-6">
        {pageHtml ? (
          <div className="bg-stone-50 border border-stone-100 rounded-[2rem] p-8">
            {pageTitle ? <div className="text-xl font-black text-stone-900 mb-4">{pageTitle}</div> : null}
            <div className="prose prose-stone max-w-none" dangerouslySetInnerHTML={{ __html: pageHtml }} />
          </div>
        ) : null}
        <div className="bg-white p-10 rounded-[3rem] border border-stone-100 shadow-sm">
          <div className="text-center text-stone-400 font-bold uppercase tracking-widest text-xs">
            {lang === 'en' ? 'No active poll.' : 'Žádná aktivní anketa.'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {pageHtml ? (
        <div className="bg-stone-50 border border-stone-100 rounded-[2rem] p-8">
          {pageTitle ? <div className="text-xl font-black text-stone-900 mb-4">{pageTitle}</div> : null}
          <div className="prose prose-stone max-w-none" dangerouslySetInnerHTML={{ __html: pageHtml }} />
        </div>
      ) : null}

      <div className="bg-white p-10 rounded-[3rem] border border-stone-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 text-green-100">
          <HelpCircle size={80} />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-green-100 text-green-600 rounded-xl">
              <CheckCircle size={18} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-green-600">{lang === 'en' ? 'Poll' : 'Anketa'}</span>
          </div>

          <h3 className="text-2xl font-black text-stone-900 mb-8 max-w-[80%] leading-tight">
            {lang === 'en' && poll.question_en ? poll.question_en : poll.question}
          </h3>

          <div className="space-y-3">
            {(poll.poll_options || []).map((opt: any) => {
              const percentage = totalVotes > 0 ? Math.round(((opt.votes || 0) / totalVotes) * 100) : 0;
              return (
                <div key={opt.id} className="relative">
                  <button
                    type="button"
                    disabled={voted || votingId !== null}
                    onClick={() => vote(opt.id)}
                    className={`w-full text-left p-5 rounded-2xl font-bold transition-all relative overflow-hidden flex justify-between items-center ${
                      voted ? 'bg-stone-50 text-stone-400 cursor-default' : 'bg-stone-50 text-stone-700 hover:bg-green-50 hover:text-green-700 hover:scale-[1.02]'
                    }`}
                  >
                    <span className="relative z-10">{lang === 'en' && opt.option_text_en ? opt.option_text_en : opt.option_text}</span>
                    {voted && <span className="relative z-10 text-[10px] font-black">{percentage}%</span>}

                    {voted && (
                      <div className="absolute left-0 top-0 bottom-0 bg-green-100/50 transition-all duration-700" style={{ width: `${percentage}%` }} />
                    )}
                    {votingId === opt.id && <InlinePulse className="bg-green-600/40" size={12} />}
                  </button>
                </div>
              );
            })}
          </div>

          {voted && (
            <p className="mt-6 text-[10px] font-black uppercase tracking-widest text-stone-300 text-center">
              {lang === 'en' ? 'Total votes' : 'Celkem hlasů'}: {totalVotes}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
