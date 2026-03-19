'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { HelpCircle, CheckCircle, ArrowRight } from 'lucide-react';
import { useToast } from '@/app/context/ToastContext';
import InlinePulse from '@/app/components/InlinePulse';

export default function PollComponent({ lang }: { lang: string }) {
  const [poll, setPoll] = useState<any>(null);
  const [voted, setVoted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [votingId, setVotingId] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    async function loadPoll() {
      const { data: pollData } = await supabase
        .from('polls')
        .select(`
          *,
          poll_options (*)
        `)
        .eq('is_active', true)
        .limit(1)
        .single();
      
      if (pollData) setPoll(pollData);
      setLoading(false);
    }
    loadPoll();

    // Check if already voted in this session
    const hasVoted = localStorage.getItem(`voted_poll_${poll?.id}`);
    if (hasVoted) setVoted(true);
  }, [poll?.id]);

  const handleVote = async (optionId: string) => {
    setVotingId(optionId);
    try {
      const option = poll.poll_options.find((o: any) => o.id === optionId);
      const { error } = await supabase
        .from('poll_options')
        .update({ votes: (option.votes || 0) + 1 })
        .eq('id', optionId);
      
      if (error) throw error;
      
      localStorage.setItem(`voted_poll_${poll.id}`, 'true');
      setVoted(true);
      showToast(lang === 'cs' ? 'Hlas započítán!' : 'Vote recorded!', 'success');
      
      // Refresh poll data
      const { data: refreshed } = await supabase
        .from('polls')
        .select('*, poll_options(*)')
        .eq('id', poll.id)
        .single();
      setPoll(refreshed);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setVotingId(null);
    }
  };

  if (loading || !poll) return null;

  const totalVotes = poll.poll_options.reduce((acc: number, o: any) => acc + (o.votes || 0), 0);

  return (
    <div className="bg-white p-10 rounded-[2.5rem] border border-stone-100 shadow-2xl shadow-green-900/5 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-8 text-green-100 group-hover:text-green-200 transition-colors">
        <HelpCircle size={80} />
      </div>
      
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-green-100 text-green-600 rounded-xl">
            <CheckCircle size={18} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-green-600">Anketa</span>
        </div>

        <h3 className="text-2xl font-black text-stone-900 mb-8 max-w-[80%] leading-tight">
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
                  className={`w-full text-left p-5 rounded-2xl font-bold transition-all relative overflow-hidden flex justify-between items-center group/opt ${
                    voted ? 'bg-stone-50 text-stone-400 cursor-default' : 'bg-stone-50 text-stone-700 hover:bg-green-50 hover:text-green-700 hover:scale-[1.02]'
                  }`}
                >
                  <span className="relative z-10">{lang === 'en' && opt.option_text_en ? opt.option_text_en : opt.option_text}</span>
                  {voted && <span className="relative z-10 text-[10px] font-black">{percentage}%</span>}
                  
                  {voted && (
                    <div 
                      className="absolute left-0 top-0 bottom-0 bg-green-100/50 transition-all duration-1000" 
                      style={{ width: `${percentage}%` }} 
                    />
                  )}
                  {votingId === opt.id && <InlinePulse className="bg-green-600/40" size={12} />}
                </button>
              </div>
            );
          })}
        </div>

        {voted && (
          <p className="mt-6 text-[10px] font-black uppercase tracking-widest text-stone-300 text-center">
            Celkem hlasovalo: {totalVotes} studentů
          </p>
        )}
      </div>
    </div>
  );
}
