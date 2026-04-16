'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../../../context/ToastContext';
import { Webhook, Plus, Trash2, Edit2, Loader2, Play } from 'lucide-react';
import { SkeletonTabContent } from '../../../components/Skeleton';
import AdminModuleHeader from './ui/AdminModuleHeader';
import AdminEmptyState from './ui/AdminEmptyState';
import AdminPanel from './ui/AdminPanel';

export default function WebhooksTab() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  
  const [isEditing, setIsEditing] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', url: '', events: [] as string[], is_active: true });

  const availableEvents = [
    { id: 'new_application', label: 'Nová přihláška' },
    { id: 'new_message', label: 'Nová zpráva' },
    { id: 'new_error', label: 'Nová chyba v logu' },
    { id: 'new_member', label: 'Nový člen' },
    { id: 'test', label: 'Testovací událost' }
  ];

  const { data: webhooks = [], isLoading } = useQuery({
    queryKey: ['webhooks'],
    queryFn: async () => {
      const res = await fetch('/api/admin/webhooks');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data.webhooks || [];
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = data.id ? `/api/admin/webhooks/${data.id}` : '/api/admin/webhooks';
      const method = data.id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      setIsEditing(null);
      showToast('Uloženo', 'success');
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/webhooks/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      showToast('Smazáno', 'success');
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  if (isLoading) return <SkeletonTabContent />;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(isEditing === 'new' ? formData : { ...formData, id: isEditing.id });
  };

  const handleTest = async (url: string) => {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '**Event:** test\n**Data:**\n```json\n{\n  "message": "Testovací ping od Pupen systému"\n}\n```' })
      });
      if (!res.ok) throw new Error('Chyba při odeslání požadavku na URL');
      showToast('Test odeslán', 'success');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <AdminModuleHeader
        title="Webhooky"
        description="Notifikace do externích služeb (Slack, Discord)"
        actions={
          <button
            onClick={() => {
              setFormData({ name: '', url: '', events: [], is_active: true });
              setIsEditing('new');
            }}
            className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-stone-800 transition"
          >
            <Plus size={16} /> Přidat Webhook
          </button>
        }
      />

      {isEditing && (
        <AdminPanel className="p-8 border-green-500 ring-4 ring-green-50 animate-in zoom-in-95 duration-300">
          <form onSubmit={handleSubmit} className="space-y-6">
            <h3 className="text-xl font-black text-stone-900 mb-6">{isEditing === 'new' ? 'Nový webhook' : 'Úprava webhooku'}</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-500">Název</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700"
                  placeholder="Např. Discord Moderátoři"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-500">Webhook URL</label>
                <input
                  type="url"
                  required
                  value={formData.url}
                  onChange={e => setFormData({ ...formData, url: e.target.value })}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700"
                  placeholder="https://discord.com/api/webhooks/..."
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-500">Odebírané události</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {availableEvents.map(ev => (
                  <label key={ev.id} className="flex items-center gap-3 p-3 rounded-xl border border-stone-100 bg-stone-50 cursor-pointer hover:bg-stone-100">
                    <input 
                      type="checkbox"
                      checked={formData.events.includes(ev.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, events: [...formData.events, ev.id] });
                        } else {
                          setFormData({ ...formData, events: formData.events.filter(x => x !== ev.id) });
                        }
                      }}
                      className="accent-green-600 w-4 h-4"
                    />
                    <span className="text-xs font-bold text-stone-700">{ev.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={formData.is_active}
                  onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                  className="accent-green-600 w-5 h-5"
                />
                <span className="text-sm font-bold text-stone-700">Webhook je aktivní</span>
              </label>
            </div>

            <div className="flex gap-3 pt-4 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setIsEditing(null)}
                className="px-6 py-3 rounded-xl font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 transition"
              >
                Zrušit
              </button>
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="px-6 py-3 rounded-xl font-bold text-white bg-green-600 hover:bg-green-700 transition flex items-center gap-2 shadow-lg shadow-green-600/20"
              >
                {saveMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : null}
                Uložit webhook
              </button>
            </div>
          </form>
        </AdminPanel>
      )}

      {!isEditing && webhooks.length === 0 ? (
        <AdminEmptyState
          icon={Webhook}
          title="Žádné webhooky"
          description="Přidejte webhook pro automatické upozorňování externích služeb."
        />
      ) : !isEditing && (
        <div className="grid md:grid-cols-2 gap-6">
          {webhooks.map((wh: any) => (
            <AdminPanel key={wh.id} className="p-6 group relative overflow-hidden">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg ${wh.is_active ? 'bg-green-600 shadow-green-600/30' : 'bg-stone-400 shadow-stone-400/30'}`}>
                    <Webhook size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-stone-900 text-lg">{wh.name}</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                      {wh.is_active ? 'Aktivní' : 'Vypnuto'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleTest(wh.url)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition" title="Testovací ping">
                    <Play size={16} />
                  </button>
                  <button onClick={() => {
                    setFormData({ name: wh.name, url: wh.url, events: wh.events || [], is_active: wh.is_active });
                    setIsEditing(wh);
                  }} className="p-2 bg-stone-50 text-stone-600 rounded-lg hover:bg-stone-100 transition">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => {
                    if (confirm('Opravdu smazat?')) deleteMutation.mutate(wh.id);
                  }} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="space-y-4">
                <div className="bg-stone-50 rounded-lg p-3 overflow-hidden">
                  <p className="text-xs font-mono text-stone-500 truncate">{wh.url}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Události</p>
                  <div className="flex flex-wrap gap-2">
                    {wh.events?.map((ev: string) => {
                      const label = availableEvents.find(e => e.id === ev)?.label || ev;
                      return (
                        <span key={ev} className="px-2 py-1 bg-stone-100 text-stone-600 rounded text-xs font-bold">
                          {label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </AdminPanel>
          ))}
        </div>
      )}
    </div>
  );
}
