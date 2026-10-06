'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { HelpCircle, CheckCircle, ArrowRight } from 'lucide-react';
import { useToast } from '@/app/context/ToastContext';
import InlinePulse from '@/app/components/InlinePulse';
import Link from 'next/link';

export default function PollComponent({ lang }: { lang: string }) {
  const [poll, setPoll] = useState<any>(null);
  const [voted, setVoted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [authMissing, setAuthMissing] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    async function loadPoll() {
      setLoading(true);
      setAuthMissing(false);
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          setAuthMissing(true);
          setPoll(null);
          setVoted(false);
          return;
        }

        const res = await fetch('/api/polls/active', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'Chyba');

        setPoll(json?.poll || null);
        setVoted(!!json?.voted);
      } catch (e: any) {
        showToast(e?.message || 'Chyba', 'error');
      } finally {
        setLoading(false);
      }
    }
    loadPoll();
  }, [lang, showToast]);

  const handleVote = async (optionId: string) => {
    setVotingId(optionId);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error(lang === 'cs' ? 'Nejste přihlášen/a.' : 'You are not signed in.');

      const res = await fetch('/api/polls/vote', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ pollId: poll.id, optionId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Chyba');

      if (json?.alreadyVoted) {
        setVoted(true);
        showToast(lang === 'cs' ? 'Už máte odhlasováno.' : 'You already voted.', 'success');
        return;
      }

      setVoted(true);
      showToast(lang === 'cs' ? 'Hlas započítán!' : 'Vote recorded!', 'success');
      if (json?.poll) setPoll(json.poll);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setVotingId(null);
    }
  };

  if (loading) return null;

  if (authMissing) {
    return (
      <div className="bg-white dark:bg-black p-10 rounded-[2.5rem] border-2 border-black dark:border-white relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 text-green-100 dark:text-green-950 group-hover:text-green-200 dark:group-hover:text-green-900 transition-colors">
          <HelpCircle size={80} />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 rounded-xl border-2 border-green-600 dark:border-green-400">
              <CheckCircle size={18} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-green-600 dark:text-green-400">Anketa</span>
          </div>
          <h3 className="text-2xl font-black text-black dark:text-white mb-4 leading-tight">
            {lang === 'cs' ? 'Anketa je pro přihlášené členy' : 'Poll is for signed-in members'}
          </h3>
          <p className="text-stone-500 dark:text-stone-400 font-medium leading-relaxed">
            {lang === 'cs'
              ? 'Přihlas se a můžeš hlasovat.'
              : 'Sign in to vote.'}
          </p>
          <div className="mt-6">
            <Link
              href={`/${lang}/login`}
              className="inline-flex items-center gap-2 rounded-2xl px-6 py-4 text-[10px] font-black uppercase tracking-widest border-2 border-green-600 dark:border-green-400 bg-green-600 dark:bg-green-500 text-white hover:bg-green-700 dark:hover:bg-green-600 transition"
            >
              {lang === 'cs' ? 'Přihlásit se' : 'Sign in'} <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!poll) return null;

  const totalVotes = poll.poll_options.reduce((acc: number, o: any) => acc + (o.votes || 0), 0);

  return (
    <div className="bg-white dark:bg-black p-10 rounded-[2.5rem] border-2 border-black dark:border-white relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-8 text-green-100 dark:text-green-950 group-hover:text-green-200 dark:group-hover:text-green-900 transition-colors">
        <HelpCircle size={80} />
      </div>
      
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 rounded-xl border-2 border-green-600 dark:border-green-400">
            <CheckCircle size={18} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-green-600 dark:text-green-400">Anketa</span>
        </div>

        <h3 className="text-2xl font-black text-black dark:text-white mb-8 max-w-[80%] leading-tight">
          {lang === 'en' && poll.question_en ? poll.question_en : poll.question}
        </h3>

        <div className="space-y-3">
          {poll.poll_options.map((opt: any) => {
            const percentage = totalVotes > 0 ? Math.round(((opt.votes || 0) / totalVotes) * 100) : 0;
            return (
              <div key={opt.id} className="relative">
                <button
                  disabled={voted || votingId !== null}
                  onClick={() => handleVote(opt.id)}
                  className={`w-full text-left p-5 rounded-2xl font-bold transition-all relative overflow-hidden flex justify-between items-center group/opt border-2 ${
                    voted ? 'bg-white dark:bg-black border-black/20 dark:border-white/20 text-stone-400 dark:text-stone-500 cursor-default' : 'bg-white dark:bg-black border-black dark:border-white text-black dark:text-white hover:bg-green-50 dark:hover:bg-green-950 hover:border-green-600 dark:hover:border-green-400 hover:text-green-700 dark:hover:text-green-400 hover:scale-[1.02]'
                  }`}
                >
                  <span className="relative z-10">{lang === 'en' && opt.option_text_en ? opt.option_text_en : opt.option_text}</span>
                  {voted && <span className="relative z-10 text-[10px] font-black">{percentage}%</span>}
                  
                  {voted && (
                    <div 
                      className="absolute left-0 top-0 bottom-0 bg-green-100/50 dark:bg-green-900/30 transition-all duration-1000" 
                      style={{ width: `${percentage}%` }} 
                    />
                  )}
                  {votingId === opt.id && <InlinePulse className="bg-green-600/40 dark:bg-green-500/40" size={12} />}
                </button>
              </div>
            );
          })}
        </div>

        {voted && (
          <p className="mt-6 text-[10px] font-black uppercase tracking-widest text-stone-400 dark:text-stone-500 text-center">
            Celkem hlasovalo: {totalVotes} studentů
          </p>
        )}
      </div>
    </div>
  );
}
