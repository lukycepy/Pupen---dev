'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import InlinePulse from '@/app/components/InlinePulse';
import { Heart, MessageSquare } from 'lucide-react';

export default function NewsFeedback({ postId, lang }: { postId: string; lang: string }) {
  const [likes, setLikes] = useState(0);
  const [mine, setMine] = useState<string | null>(null);
  const [likeBusy, setLikeBusy] = useState(false);

  const [comments, setComments] = useState<any[]>([]);
  const [commentsBusy, setCommentsBusy] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentError, setCommentError] = useState('');
  const [commentInfo, setCommentInfo] = useState('');

  const commentCount = useMemo(() => comments.filter((c) => c?.status === 'approved').length, [comments]);

  const loadReactions = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const res = await fetch(`/api/posts/${postId}/reactions`, {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return;
      setLikes(Number(json?.likes || 0));
      setMine(json?.mine ? String(json.mine) : null);
    } catch {}
  };

  const loadComments = async () => {
    setCommentsBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return;
      setComments(Array.isArray(json?.comments) ? json.comments : []);
    } catch {
      setComments([]);
    } finally {
      setCommentsBusy(false);
    }
  };

  useEffect(() => {
    loadReactions();
    loadComments();
  }, [postId]);

  const toggleLike = async () => {
    setLikeBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setLikeBusy(false);
        return;
      }
      const on = mine !== 'like';
      const res = await fetch(`/api/posts/${postId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ on, reaction: 'like' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return;
      setLikes(Number(json?.likes || 0));
      setMine(json?.mine ? String(json.mine) : null);
    } finally {
      setLikeBusy(false);
    }
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    setCommentError('');
    setCommentInfo('');
    const text = String(commentText || '').trim();
    if (!text) return;
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setCommentError(lang === 'en' ? 'Please sign in to comment.' : 'Pro komentář se přihlaste.');
        return;
      }
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ body: text }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCommentError(String(json?.error || (lang === 'en' ? 'Error' : 'Chyba')));
        return;
      }
      setCommentText('');
      setCommentInfo(lang === 'en' ? 'Comment submitted for approval.' : 'Komentář odeslán ke schválení.');
      await loadComments();
    } catch {
      setCommentError(lang === 'en' ? 'Error' : 'Chyba');
    }
  };

  return (
    <div className="mt-16 space-y-10">
      <div className="bg-stone-50 border border-stone-100 rounded-[2.5rem] p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleLike}
            disabled={likeBusy}
            className={`inline-flex items-center gap-2 rounded-2xl px-5 py-4 text-[10px] font-black uppercase tracking-widest transition-all border ${
              mine === 'like' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
            }`}
          >
            {likeBusy ? <InlinePulse className={mine === 'like' ? 'bg-white/80' : 'bg-stone-300'} size={12} /> : <Heart size={16} />}
            {lang === 'en' ? 'Like' : 'Líbí se mi'}
          </button>
          <div className="text-xs font-bold text-stone-500">
            {likes} {lang === 'en' ? 'likes' : 'líbí se mi'}
          </div>
        </div>
        <div className="flex items-center gap-2 text-stone-500 font-bold">
          <MessageSquare size={18} /> {commentCount} {lang === 'en' ? 'comments' : 'komentářů'}
        </div>
      </div>

      <div className="bg-white border border-stone-100 rounded-[2.5rem] p-8">
        <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-6">
          {lang === 'en' ? 'Comments' : 'Komentáře'}
        </div>

        <form onSubmit={submitComment} className="space-y-3">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder={lang === 'en' ? 'Write a comment…' : 'Napište komentář…'}
            className="w-full min-h-[120px] bg-stone-50 border border-stone-100 rounded-2xl px-5 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 outline-none transition"
          />
          {commentError ? <div className="text-xs font-bold text-red-600">{commentError}</div> : null}
          {commentInfo ? <div className="text-xs font-bold text-green-700">{commentInfo}</div> : null}
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-4 text-[10px] font-black uppercase tracking-widest border border-green-200 bg-green-600 text-white hover:bg-green-700 transition"
          >
            {lang === 'en' ? 'Send comment' : 'Odeslat komentář'}
          </button>
        </form>

        <div className="mt-8 space-y-4">
          {commentsBusy ? (
            <div className="py-10 flex justify-center">
              <InlinePulse className="bg-stone-200" size={18} />
            </div>
          ) : (
            <>
              {comments.filter((c) => c?.status === 'approved').length === 0 ? (
                <div className="py-10 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">
                  {lang === 'en' ? 'No comments yet.' : 'Zatím žádné komentáře.'}
                </div>
              ) : (
                comments
                  .filter((c) => c?.status === 'approved')
                  .map((c) => (
                    <div key={c.id} className="bg-stone-50 border border-stone-100 rounded-2xl p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-black text-stone-900 truncate">{c.author_name || (lang === 'en' ? 'Member' : 'Člen')}</div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-stone-300">
                          {c.created_at ? new Date(c.created_at).toLocaleString(lang === 'en' ? 'en-US' : 'cs-CZ') : '—'}
                        </div>
                      </div>
                      <div className="mt-3 text-stone-700 font-medium whitespace-pre-wrap">{String(c.body || '')}</div>
                    </div>
                  ))
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

