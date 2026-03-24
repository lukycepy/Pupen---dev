'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Mail, Users, Send, Trash2, Download, Search } from 'lucide-react';
import { useToast } from '@/app/context/ToastContext';
import ConfirmModal from '@/app/components/ConfirmModal';
import { SkeletonTabContent } from '@/app/[lang]/components/Skeleton';

export default function NewsletterTab({ dict }: { dict: any }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeHtml, setComposeHtml] = useState('');
  const [composeCats, setComposeCats] = useState<string[]>(['all']);
  const [sending, setSending] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ title: string; message: string; onConfirm: () => void }>({
    title: '',
    message: '',
    onConfirm: () => {}
  });

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      setLoading(true);
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error('Unauthorized');
        const res = await fetch('/api/admin/newsletter/subscribers', { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'Chyba');
        if (!isMounted) return;
        setSubscribers(Array.isArray(json?.subscribers) ? json.subscribers : []);
      } catch (err: any) {
        showToast(err.message, 'error');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    run();
    return () => { isMounted = false; };
  }, [showToast]);

  const handleDelete = async (id: string) => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch(`/api/admin/newsletter/subscribers/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Chyba');
      showToast('Odběratel smazán', 'success');
      setSubscribers(subscribers.filter(s => s.id !== id));
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const toggleComposeCat = (id: string) => {
    if (id === 'all') {
      setComposeCats(['all']);
    } else {
      const filtered = composeCats.filter((c) => c !== 'all');
      if (filtered.includes(id)) {
        const next = filtered.filter((c) => c !== id);
        setComposeCats(next.length === 0 ? ['all'] : next);
      } else {
        setComposeCats([...filtered, id]);
      }
    }
  };

  const sendNewsletter = async () => {
    setSending(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch('/api/admin/newsletter/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subject: composeSubject, html: composeHtml, categories: composeCats }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Chyba');
      showToast(`Newsletter odeslán: ${json?.sent || 0}/${json?.recipients || 0}`, 'success');
      setComposeSubject('');
      setComposeHtml('');
      setComposeCats(['all']);
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setSending(false);
    }
  };

  const confirmDelete = (id: string, email: string) => {
    setModalConfig({
      title: 'Smazat odběratele?',
      message: `Opravdu chcete smazat e-mail ${email} z databáze newsletteru?`,
      onConfirm: () => handleDelete(id)
    });
    setModalOpen(true);
  };

  const handleExport = () => {
    if (subscribers.length === 0) return;

    const csvContent = [
      ['Email', 'Kategorie', 'Datum přihlášení'],
      ...subscribers.map(s => [
        s.email, 
        s.categories?.join('; ') || 'all', 
        new Date(s.created_at).toLocaleString()
      ])
    ].map(e => e.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'newsletter_subscribers.csv');
    link.click();
  };

  const filteredSubscribers = subscribers.filter(s => {
    const matchesSearch = s.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || (s.categories && s.categories.includes(categoryFilter));
    return matchesSearch && matchesCategory;
  });

  if (loading) return <SkeletonTabContent />;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-[2rem] border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-xl font-bold flex items-center gap-3">
          <Mail className="text-green-600" />
          Správa Newsletteru
        </h2>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 bg-stone-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-stone-800 transition shadow-lg text-sm"
          >
            <Download size={18} />
            Exportovat CSV
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] border shadow-sm">
        <div className="flex items-center justify-between gap-4 mb-6">
          <h3 className="text-lg font-bold flex items-center gap-3">
            <Send className="text-green-600" />
            Odeslat newsletter
          </h3>
          <button
            disabled={sending || !composeSubject.trim() || !composeHtml.trim()}
            onClick={sendNewsletter}
            className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-green-700 transition shadow-lg text-sm disabled:opacity-50"
          >
            <Send size={18} />
            Odeslat
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Předmět</div>
              <input
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                className="w-full px-4 py-3 bg-stone-50 rounded-xl border border-stone-100 focus:ring-2 focus:ring-green-500 transition font-medium"
                placeholder="Např. Novinky týdne"
              />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Kategorie</div>
              <div className="flex flex-wrap gap-2">
                {['all', 'Párty', 'Vzdělávání', 'Výlet'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleComposeCat(cat)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${composeCats.includes(cat) ? 'bg-green-600 text-white border-green-600' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'}`}
                  >
                    {cat === 'all' ? 'Všechny' : cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-xs text-stone-500 font-medium">
              HTML se odešle tak, jak ho vložíš.
            </div>
          </div>

          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Obsah (HTML)</div>
            <textarea
              value={composeHtml}
              onChange={(e) => setComposeHtml(e.target.value)}
              className="w-full min-h-[220px] px-4 py-3 bg-stone-50 rounded-xl border border-stone-100 focus:ring-2 focus:ring-green-500 transition font-mono text-xs"
              placeholder="<h3>Ahoj!</h3><p>…</p>"
            />
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-6">
        {/* STATS */}
        <div className="md:col-span-1 space-y-4">
          <div className="bg-white p-6 rounded-2xl border shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Celkem odběratelů</p>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-black text-stone-900">{subscribers.length}</span>
              <Users size={20} className="text-green-600 mb-1" />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-2xl border shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4">Filtr kategorií</p>
            <div className="space-y-2">
              {['all', 'Párty', 'Vzdělávání', 'Výlet'].map(cat => (
                <button 
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all ${categoryFilter === cat ? 'bg-green-600 text-white' : 'hover:bg-stone-50 text-stone-600'}`}
                >
                  {cat === 'all' ? 'Všechny' : cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* LIST */}
        <div className="md:col-span-3 space-y-4">
          <div className="bg-white p-4 rounded-2xl border shadow-sm flex items-center gap-4">
            <div className="relative flex-grow">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
              <input 
                type="text" 
                placeholder="Hledat e-mail..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-6 py-3 bg-stone-50 border-none rounded-xl focus:ring-2 focus:ring-green-500 transition font-medium"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-stone-50 border-b">
                <tr className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                  <th className="px-6 py-4">E-mail</th>
                  <th className="px-6 py-4">Kategorie</th>
                  <th className="px-6 py-4">Datum</th>
                  <th className="px-6 py-4 text-right">Akce</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {filteredSubscribers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-20 text-center text-stone-400 font-bold">
                      Žádní odběratelé k zobrazení
                    </td>
                  </tr>
                ) : (
                  filteredSubscribers.map((s) => (
                    <tr key={s.id} className="hover:bg-stone-50/50 transition group">
                      <td className="px-6 py-4 font-bold text-stone-900">{s.email}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {s.categories?.map((cat: string) => (
                            <span key={cat} className="text-[9px] font-black uppercase tracking-widest bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">
                              {cat}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-stone-500 font-medium">
                        {new Date(s.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => confirmDelete(s.id, s.email)}
                          className="p-2 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ConfirmModal 
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={modalConfig.onConfirm}
        title={modalConfig.title}
        message={modalConfig.message}
      />
    </div>
  );
}
