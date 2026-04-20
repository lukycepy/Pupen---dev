'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/lib/supabase';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Plus, Trash2, Edit3, Image as ImageIcon, Calendar as CalendarIcon, MapPin, Clock, Download, Loader2, Save, X, Eye, EyeOff, CalendarClock, Archive, RotateCcw, ChevronsUp } from 'lucide-react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useToast } from '../../../../context/ToastContext';
import { logAdminAction } from '@/lib/admin-logger';
import ConfirmModal from '@/app/components/ConfirmModal';
import { draftEventDescriptionHtmlCz, draftEventDescriptionHtmlEn, seoSuggestions, suggestEnglishText } from '@/lib/ai/pilot';
import AdminModuleHeader from './ui/AdminModuleHeader';
import { DEFAULT_WAITLIST_CONFIG, normalizeWaitlistConfig } from '@/lib/rsvp/waitlistConfig';

const Editor = dynamic(() => import('../../../components/Editor'), { 
  ssr: false,
  loading: () => <div className="h-[200px] w-full bg-stone-50 animate-pulse rounded-xl border border-dashed border-stone-200" />
});

function htmlToText(html: string) {
  const s = String(html || '').trim();
  if (!s) return '';
  if (typeof window !== 'undefined') {
    try {
      const div = document.createElement('div');
      div.innerHTML = s;
      return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
    } catch {}
  }
  return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

interface EventsTabProps {
  dict: any;
  events: any[];
  uploadImage: (file: File, bucket: string, pathPrefix?: string) => Promise<string>;
  currentUser: any;
  userProfile: any;
  readOnly?: boolean;
}

export default function EventsTab({ dict, events, uploadImage, currentUser, userProfile, readOnly = false }: EventsTabProps) {
  const eventSchema = z.object({
    title: z.string().min(3, dict.admin.validation.min3),
    title_en: z.string().optional(),
    date: z.string().min(1, dict.admin.validation.required),
    time: z.string().min(1, dict.admin.validation.required),
    location: z.string().min(1, dict.admin.validation.required),
    category: z.string(),
    description: z.string().optional(),
    description_en: z.string().optional(),
    published_at: z.string().optional(),
    capacity: z.preprocess((val) => {
      if (val === "" || val === null || val === undefined) return null;
      const num = Number(val);
      return isNaN(num) ? null : num;
    }, z.number().nullable().optional()),
    ticket_sale_end: z.string().optional(),
    is_member_only: z.boolean().optional(),
  });

  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [eventPhotoFiles, setEventPhotoFiles] = useState<File[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [localSearch, setLocalSearch] = useState('');
  const [listView, setListView] = useState<'active' | 'archive'>('active');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ title: string; message: string; onConfirm: () => void }>({
    title: '',
    message: '',
    onConfirm: () => {}
  });
  const [nowTs, setNowTs] = useState(0);
  useEffect(() => {
    setNowTs(Date.now());
    const t = setInterval(() => setNowTs(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const [waitlistConfigDraft, setWaitlistConfigDraft] = useState<any>(DEFAULT_WAITLIST_CONFIG);
  const [waitlistConfigUpdatedAt, setWaitlistConfigUpdatedAt] = useState<string | null>(null);
  const [waitlistConfigLoading, setWaitlistConfigLoading] = useState(false);
  const [waitlistConfigSaving, setWaitlistConfigSaving] = useState(false);
  const [advancingEventId, setAdvancingEventId] = useState<string | null>(null);

  const loadWaitlistConfig = useCallback(async () => {
    setWaitlistConfigLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch('/api/admin/waitlist/config', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      setWaitlistConfigDraft(json?.config ? normalizeWaitlistConfig(json.config) : DEFAULT_WAITLIST_CONFIG);
      setWaitlistConfigUpdatedAt(json?.updatedAt || null);
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setWaitlistConfigLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadWaitlistConfig();
  }, [loadWaitlistConfig]);

  const saveWaitlistConfig = useCallback(async () => {
    setWaitlistConfigSaving(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch('/api/admin/waitlist/config/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ config: normalizeWaitlistConfig(waitlistConfigDraft) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      showToast(dict.admin?.saved || 'Uloženo', 'success');
      await loadWaitlistConfig();
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setWaitlistConfigSaving(false);
    }
  }, [dict.admin?.saved, loadWaitlistConfig, showToast, waitlistConfigDraft]);

  const advanceWaitlist = useCallback(async (eventId: string, reason: string, silent = false) => {
    const id = String(eventId || '').trim();
    if (!id) return;
    setAdvancingEventId(id);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch('/api/admin/waitlist/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ eventId: id, reason }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      const promoted = Number(json?.result?.promoted || json?.result?.result?.promoted || 0);
      if (!silent) {
        if (promoted > 0) showToast(`Posunuto z čekací listiny: ${promoted}`, 'success');
        else showToast('Čekací listina je bez změn', 'info');
      }
    } catch (e: any) {
      if (!silent) showToast(e?.message || 'Chyba', 'error');
    } finally {
      setAdvancingEventId(null);
    }
  }, [showToast]);

  const { data: eventPhotos = [] } = useQuery({
    queryKey: ['event_photos', editingEvent?.id],
    enabled: !!editingEvent?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_photos')
        .select('*')
        .eq('event_id', editingEvent.id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const uploadEventPhotosMutation = useMutation({
    mutationFn: async () => {
      if (!editingEvent?.id) throw new Error('Nejdřív ulož akci.');
      if (eventPhotoFiles.length === 0) throw new Error('Vyber fotky.');

      for (const f of eventPhotoFiles) {
        const url = await uploadImage(f, 'gallery', `events/${editingEvent.id}`);
        const { error } = await supabase.from('event_photos').insert([{ event_id: editingEvent.id, image_url: url }]);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      setEventPhotoFiles([]);
      await queryClient.invalidateQueries({ queryKey: ['event_photos', editingEvent?.id] });
      showToast('Fotky k události nahrány', 'success');
    },
    onError: (err: any) => showToast(err?.message || 'Chyba', 'error'),
  });

  const deleteEventPhotoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('event_photos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event_photos', editingEvent?.id] }),
    onError: (err: any) => showToast(err?.message || 'Chyba', 'error'),
  });

  const publishMutation = useMutation({
    mutationFn: async ({ id, published_at }: { id: string; published_at: string | null }) => {
      const { error } = await supabase.from('events').update({ published_at }).eq('id', id);
      if (error) throw error;
      try {
        const action = published_at ? 'Publikoval akci' : 'Zrušil publikaci akce';
        await logAdminAction(
          currentUser?.email,
          `${action}: ${id}`,
          id,
          { published_at },
          userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : undefined
        );
      } catch {}
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      showToast(dict.admin?.saved || 'Uloženo', 'success');
    },
    onError: (err: any) => {
      showToast(err?.message || 'Chyba', 'error');
    },
  });

  const getPublishState = (event: any) => {
    if (!event.published_at) return 'draft';
    const ts = new Date(event.published_at).getTime();
    if (Number.isNaN(ts)) return 'draft';
    return ts <= nowTs ? 'published' : 'scheduled';
  };

  const askTogglePublish = (event: any, mode: 'toggle' | 'clear_schedule' = 'toggle') => {
    const state = getPublishState(event);
    const next =
      mode === 'clear_schedule' ? null : state === 'published' ? null : new Date().toISOString();

    const title =
      mode === 'clear_schedule'
        ? 'Zrušit plánované zveřejnění?'
        : state === 'published'
          ? 'Zrušit publikaci?'
          : 'Publikovat teď?';

    const message =
      mode === 'clear_schedule'
        ? 'Akce přestane být naplánovaná ke zveřejnění.'
        : state === 'published'
          ? 'Akce se přestane zobrazovat veřejně na webu.'
          : 'Akce se začne zobrazovat veřejně na webu.';

    setModalConfig({
      title,
      message,
      onConfirm: () => publishMutation.mutate({ id: event.id, published_at: next }),
    });
    setModalOpen(true);
  };

  const { register, handleSubmit, reset, setValue, control, formState: { errors } } = useForm<any>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      category: 'Párty',
      is_member_only: false,
      description: '',
      description_en: '',
      title: '',
      title_en: '',
      date: '',
      time: '',
      location: '',
      capacity: null,
      published_at: '',
      ticket_sale_end: ''
    }
  });

  const description = useWatch({ control, name: 'description' }) || '';
  const descriptionEn = useWatch({ control, name: 'description_en' }) || '';
  const title = useWatch({ control, name: 'title' }) || '';
  const titleEn = useWatch({ control, name: 'title_en' }) || '';
  const date = useWatch({ control, name: 'date' }) || '';
  const time = useWatch({ control, name: 'time' }) || '';
  const location = useWatch({ control, name: 'location' }) || '';
  const category = useWatch({ control, name: 'category' }) || '';
  const isMemberOnly = !!useWatch({ control, name: 'is_member_only' });
  const publishedAt = useWatch({ control, name: 'published_at' }) || '';
  const isDraft = !String(publishedAt || '').trim();

  const seo = seoSuggestions({
    title: title,
    descriptionHtml: description,
    imageUrl: imageFile ? 'local' : editingEvent?.image_url,
    canonicalPath: editingEvent?.id ? `/cs/akce/${editingEvent.id}` : undefined,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      let imageUrl = editingEvent?.image_url || null;
      if (imageFile) {
        if (imageFile.size > 5 * 1024 * 1024) { // 5MB limit
          throw new Error('Obrázek je příliš velký (max 5MB).');
        }
        try {
          imageUrl = await uploadImage(imageFile, 'events');
        } catch (uploadErr) {
          console.error('Image upload failed:', uploadErr);
          throw new Error('Nepodařilo se nahrát obrázek. Zkuste jiný soubor nebo zkontrolujte připojení.');
        }
      }
      
      const payload = { 
        title: data.title,
        title_en: data.title_en || null,
        date: data.date,
        time: data.time,
        location: data.location,
        category: data.category,
        description_html: (data.description || '').trim() ? String(data.description) : null,
        description_html_en: (data.description_en || '').trim() ? String(data.description_en) : null,
        description: (data.description || '').trim() ? htmlToText(String(data.description)) : null,
        description_en: (data.description_en || '').trim() ? htmlToText(String(data.description_en)) : null,
        image_url: imageUrl,
        published_at: data.published_at && data.published_at !== "" ? new Date(data.published_at).toISOString() : null,
        capacity: (data.capacity === "" || data.capacity === null || isNaN(data.capacity)) ? null : Number(data.capacity),
        ticket_sale_end: data.ticket_sale_end && data.ticket_sale_end !== "" ? new Date(data.ticket_sale_end).toISOString() : null,
        is_member_only: !!data.is_member_only
      };
      const withoutTicketSaleEnd = () => {
        const next: any = { ...(payload as any) };
        delete next.ticket_sale_end;
        return next;
      };

      if (editingEvent?.id) {
        const prevCapacity = editingEvent?.capacity == null ? null : Number(editingEvent.capacity);
        const nextCapacity = payload.capacity == null ? null : Number(payload.capacity);
        // Save current version for Audit Log 2.0
        try {
          const { data: currentEv } = await supabase.from('events').select('*').eq('id', editingEvent.id).single();
          if (currentEv) {
            await supabase.from('content_versions').insert([{
              table_name: 'events',
              record_id: editingEvent.id,
              version_data: currentEv,
              created_by: currentUser?.id
            }]);
          }
        } catch (vErr) {
          console.error('Failed to save version:', vErr);
        }

        let { error } = await supabase.from('events').update(payload).eq('id', editingEvent.id);
        if (
          error &&
          /ticket_sale_end/i.test(error.message) &&
          /(schema cache|does not exist|column)/i.test(error.message)
        ) {
          const retry = await supabase.from('events').update(withoutTicketSaleEnd()).eq('id', editingEvent.id);
          error = retry.error;
        }
        if (error) throw error;

        try {
          const cfg = normalizeWaitlistConfig(waitlistConfigDraft);
          if (cfg.autoAdvanceOnCapacityIncrease && typeof prevCapacity === 'number' && typeof nextCapacity === 'number' && nextCapacity > prevCapacity) {
            await advanceWaitlist(editingEvent.id, 'capacity_increase', true);
          }
        } catch {}
        
        try {
          await logAdminAction(currentUser?.email, `Upravil akci: ${data.title}`, editingEvent.id, payload, userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : undefined);
        } catch (logErr) {
          console.error('Failed to log admin action:', logErr);
        }
      } else {
        let { data: newEvent, error } = await supabase.from('events').insert([payload]).select().single();
        if (
          error &&
          /ticket_sale_end/i.test(error.message) &&
          /(schema cache|does not exist|column)/i.test(error.message)
        ) {
          const retry = await supabase.from('events').insert([withoutTicketSaleEnd()]).select().single();
          newEvent = retry.data;
          error = retry.error;
        }
        if (error) throw error;
        
        try {
          await logAdminAction(currentUser?.email, `Vytvořil akci: ${data.title}`, newEvent.id, payload, userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : undefined);
        } catch (logErr) {
          console.error('Failed to log admin action:', logErr);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      handleCancel();
      showToast(dict.admin.alertEventSuccess, 'success');
    },
    onError: (err: any) => {
      showToast(err.message, 'error');
    }
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ ids, mode }: { ids?: string[]; mode: 'archive' | 'restore' | 'archive_past' }) => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch('/api/admin/events/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mode, ids: ids || [] }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Chyba');
      return json;
    },
    onSuccess: (json: any) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setModalOpen(false);
      setSelectedIds([]);
      const a = Number(json?.archived || 0);
      const r = Number(json?.restored || 0);
      if (a) showToast(`Přesunuto do archivu aktivit: ${a}`, 'success');
      else if (r) showToast(`Vráceno z archivu: ${r}`, 'success');
      else showToast(dict.admin?.saved || 'Uloženo', 'success');
    },
    onError: (err: any) => showToast(err?.message || 'Chyba', 'error'),
  });

  const onSubmit = (data: any) => {
    saveMutation.mutate(data);
  };

  const handleEdit = (event: any) => {
    setEditingEvent(event);
    reset({
      title: event.title,
      title_en: event.title_en || '',
      date: event.date,
      time: event.time,
      location: event.location,
      category: event.category,
      description: event.description_html || event.description || '',
      description_en: event.description_html_en || event.description_en || '',
      published_at: event.published_at ? new Date(event.published_at).toISOString().slice(0, 16) : '',
      capacity: event.capacity ?? '',
      ticket_sale_end: event.ticket_sale_end ? new Date(event.ticket_sale_end).toISOString().slice(0, 16) : '',
      is_member_only: event.is_member_only || false,
    });
  };

  const handleCancel = () => {
    setEditingEvent(null);
    setImageFile(null);
    reset();
  };

  const askArchive = (ids: string[]) => {
    setModalConfig({
      title: 'Přesunout do archivu aktivit?',
      message: `Akce se nebudou mazat. Přesunou se do archivu aktivit a přestanou se zobrazovat mezi aktivními.`,
      onConfirm: () => archiveMutation.mutate({ mode: 'archive', ids }),
    });
    setModalOpen(true);
  };

  const askRestore = (ids: string[]) => {
    setModalConfig({
      title: 'Vrátit z archivu?',
      message: 'Akce se vrátí mezi aktivní a odebere se z archivu aktivit.',
      onConfirm: () => archiveMutation.mutate({ mode: 'restore', ids }),
    });
    setModalOpen(true);
  };

  const askArchivePast = () => {
    setModalConfig({
      title: 'Přesunout proběhlé akce do archivu aktivit?',
      message: 'Všechny akce, které už proběhly, se přesunou do archivu aktivit. Nic se nemaže.',
      onConfirm: () => archiveMutation.mutate({ mode: 'archive_past' }),
    });
    setModalOpen(true);
  };

  const exportRSVP = async (eventId: string, eventTitle: string) => {
    const { data, error } = await supabase.from('rsvp').select('*').eq('event_id', eventId);
    if (error) {
      showToast(error.message, 'error');
      return;
    }
    if (!data || data.length === 0) {
      showToast(dict.admin.noParticipants || 'Žádní účastníci', 'warning');
      return;
    }

    const csv = [
      [dict.admin.labelName || 'Jméno', 'Email', dict.admin.labelDateReceived || 'Datum přihlášení'],
      ...data.map(r => [r.name, r.email, new Date(r.created_at).toLocaleString()])
    ].map(e => e.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${dict.admin.rsvpCsvName || 'rsvp'}-${eventTitle}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    setSelectedIds([]);
  }, [listView]);

  const filteredEvents = events
    .filter((ev) => {
      const isArchived = !!ev.archived_at;
      return listView === 'archive' ? isArchived : !isArchived;
    })
    .filter((ev) => {
      const q = localSearch.toLowerCase();
      return ev.title.toLowerCase().includes(q) || ev.location.toLowerCase().includes(q);
    });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <AdminModuleHeader
        title={dict.admin.tabEvents}
        description="Správa a plánování akcí pro studenty a členy"
        actions={
          <>
            {selectedIds.length > 0 && (
              listView === 'archive' ? (
                <button
                  onClick={() => askRestore(selectedIds)}
                  className="bg-stone-900 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-stone-800 transition-all shadow-sm"
                >
                  <RotateCcw size={16} /> Vrátit ({selectedIds.length})
                </button>
              ) : (
                <button
                  onClick={() => askArchive(selectedIds)}
                  className="bg-stone-900 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-stone-800 transition-all shadow-sm"
                >
                  <Archive size={16} /> Archivovat ({selectedIds.length})
                </button>
              )
            )}
            {!editingEvent && !readOnly && listView === 'active' && (
              <button
                onClick={askArchivePast}
                className="bg-white text-stone-700 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 border border-stone-200 hover:bg-stone-50 transition-all shadow-sm"
                disabled={archiveMutation.isPending}
              >
                <Archive size={16} /> Přesunout proběhlé
              </button>
            )}
            {!readOnly && !editingEvent && (
              <button 
                onClick={() => setEditingEvent({ id: null })} 
                className="bg-green-600 text-white px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-green-700 transition-all shadow-lg shadow-green-600/20"
              >
                <Plus size={16} /> {dict.admin.newEvent}
              </button>
            )}
          </>
        }
      />

      {!readOnly && (
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-stone-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-black text-stone-900">{dict.admin?.waitlist?.title || 'Čekací listina (Waitlist)'}</div>
              <div className="text-xs text-stone-500 font-semibold">
                {dict.admin?.waitlist?.subtitle || 'Pravidla posunu registrací při uvolnění kapacity (cancel/expirace/navýšení kapacity).'}
                {waitlistConfigUpdatedAt ? ` • ${new Date(waitlistConfigUpdatedAt).toLocaleString()}` : ''}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={loadWaitlistConfig}
                disabled={waitlistConfigLoading || waitlistConfigSaving}
                className="px-4 py-2 rounded-xl border border-stone-200 bg-white text-stone-700 text-xs font-black uppercase tracking-widest hover:bg-stone-50 disabled:opacity-50"
              >
                {waitlistConfigLoading ? (dict.admin?.waitlist?.loading || 'Načítám…') : (dict.admin?.waitlist?.reload || 'Obnovit')}
              </button>
              <button
                type="button"
                onClick={saveWaitlistConfig}
                disabled={waitlistConfigLoading || waitlistConfigSaving}
                className="px-4 py-2 rounded-xl bg-green-600 text-white text-xs font-black uppercase tracking-widest hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {waitlistConfigSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {dict.admin?.waitlist?.save || 'Uložit'}
              </button>
            </div>
          </div>

          <div className="mt-5 grid md:grid-cols-3 gap-4">
            <label className="flex items-center gap-3 p-4 rounded-2xl bg-stone-50 border border-stone-100">
              <input
                type="checkbox"
                checked={!!waitlistConfigDraft?.enabled}
                onChange={(e) => setWaitlistConfigDraft((p: any) => ({ ...(p || {}), enabled: e.target.checked }))}
                className="w-5 h-5 accent-green-600 rounded border-stone-300"
              />
              <div className="min-w-0">
                <div className="text-xs font-black text-stone-900">{dict.admin?.waitlist?.enabled || 'Zapnuto'}</div>
                <div className="text-[11px] text-stone-500 font-semibold">{dict.admin?.waitlist?.enabledHint || 'Pokud je vypnuto, systém waitlist neposouvá automaticky.'}</div>
              </div>
            </label>

            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-100">
              <div className="text-xs font-black text-stone-900 mb-2">{dict.admin?.waitlist?.reservationExpiresHours || 'Platnost rezervace (hodiny)'}</div>
              <input
                type="number"
                min={1}
                max={336}
                value={waitlistConfigDraft?.reservationExpiresHours ?? 24}
                onChange={(e) => setWaitlistConfigDraft((p: any) => ({ ...(p || {}), reservationExpiresHours: Number(e.target.value) }))}
                className="w-full border-none p-3 rounded-xl outline-none ring-1 ring-stone-100 focus:ring-2 focus:ring-green-500 bg-white font-bold text-stone-700 transition"
              />
              <div className="text-[11px] text-stone-500 font-semibold mt-2">{dict.admin?.waitlist?.reservationExpiresHint || 'Platí pro bankovní převod (status reserved). Po expiraci se uvolní místo.'}</div>
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-100">
              <div className="text-xs font-black text-stone-900 mb-2">{dict.admin?.waitlist?.groupHandling || 'Skupiny a kapacita'}</div>
              <select
                value={waitlistConfigDraft?.groupHandling === 'block_on_non_fit' ? 'block_on_non_fit' : 'skip_non_fit'}
                onChange={(e) => setWaitlistConfigDraft((p: any) => ({ ...(p || {}), groupHandling: e.target.value }))}
                className="w-full border-none p-3 rounded-xl outline-none ring-1 ring-stone-100 focus:ring-2 focus:ring-green-500 bg-white font-bold text-stone-700 transition"
              >
                <option value="skip_non_fit">{dict.admin?.waitlist?.groupHandlingSkip || 'Přeskočit, pokud se nevejde'}</option>
                <option value="block_on_non_fit">{dict.admin?.waitlist?.groupHandlingBlock || 'Zastavit na první, co se nevejde'}</option>
              </select>
              <div className="text-[11px] text-stone-500 font-semibold mt-2">{dict.admin?.waitlist?.groupHandlingHint || 'Deterministické pořadí (FIFO). Skupiny se nedělí.'}</div>
            </div>

            <label className="flex items-center gap-3 p-4 rounded-2xl bg-stone-50 border border-stone-100">
              <input
                type="checkbox"
                checked={waitlistConfigDraft?.notifyOnPromotion !== false}
                onChange={(e) => setWaitlistConfigDraft((p: any) => ({ ...(p || {}), notifyOnPromotion: e.target.checked }))}
                className="w-5 h-5 accent-green-600 rounded border-stone-300"
              />
              <div className="min-w-0">
                <div className="text-xs font-black text-stone-900">{dict.admin?.waitlist?.notifyOnPromotion || 'Posílat e-mail při posunu'}</div>
                <div className="text-[11px] text-stone-500 font-semibold">{dict.admin?.waitlist?.notifyOnPromotionHint || 'Při posunu z waitlistu odešle vstupenku/platební instrukce.'}</div>
              </div>
            </label>

            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-100">
              <div className="text-xs font-black text-stone-900 mb-2">{dict.admin?.waitlist?.maxPromotionsPerRun || 'Limit posunů v 1 běhu'}</div>
              <input
                type="number"
                min={1}
                max={200}
                value={waitlistConfigDraft?.maxPromotionsPerRun ?? 25}
                onChange={(e) => setWaitlistConfigDraft((p: any) => ({ ...(p || {}), maxPromotionsPerRun: Number(e.target.value) }))}
                className="w-full border-none p-3 rounded-xl outline-none ring-1 ring-stone-100 focus:ring-2 focus:ring-green-500 bg-white font-bold text-stone-700 transition"
              />
              <div className="text-[11px] text-stone-500 font-semibold mt-2">{dict.admin?.waitlist?.maxPromotionsPerRunHint || 'Chrání před masivním posunem při velké změně kapacity.'}</div>
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-100 space-y-3">
              <div className="text-xs font-black text-stone-900">{dict.admin?.waitlist?.autoAdvance || 'Automatický posun'}</div>
              <label className="flex items-center gap-2 text-[11px] font-bold text-stone-700">
                <input
                  type="checkbox"
                  checked={waitlistConfigDraft?.autoAdvanceOnCancel !== false}
                  onChange={(e) => setWaitlistConfigDraft((p: any) => ({ ...(p || {}), autoAdvanceOnCancel: e.target.checked }))}
                  className="w-4 h-4 accent-green-600 rounded border-stone-300"
                />
                {dict.admin?.waitlist?.autoAdvanceOnCancel || 'Po zrušení registrace (cancel)'}
              </label>
              <label className="flex items-center gap-2 text-[11px] font-bold text-stone-700">
                <input
                  type="checkbox"
                  checked={waitlistConfigDraft?.autoAdvanceOnCapacityIncrease !== false}
                  onChange={(e) => setWaitlistConfigDraft((p: any) => ({ ...(p || {}), autoAdvanceOnCapacityIncrease: e.target.checked }))}
                  className="w-4 h-4 accent-green-600 rounded border-stone-300"
                />
                {dict.admin?.waitlist?.autoAdvanceOnCapacityIncrease || 'Po navýšení kapacity'}
              </label>
              <label className="flex items-center gap-2 text-[11px] font-bold text-stone-700">
                <input
                  type="checkbox"
                  checked={waitlistConfigDraft?.autoAdvanceOnReservationExpiry !== false}
                  onChange={(e) => setWaitlistConfigDraft((p: any) => ({ ...(p || {}), autoAdvanceOnReservationExpiry: e.target.checked }))}
                  className="w-4 h-4 accent-green-600 rounded border-stone-300"
                />
                {dict.admin?.waitlist?.autoAdvanceOnReservationExpiry || 'Po expiraci rezervace (cron)'}
              </label>
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* FORM SECTION - ONLY SHOW WHEN ADDING/EDITING */}
        {editingEvent && (
          <div className="lg:col-span-5 xl:col-span-4 bg-white p-8 rounded-[2.5rem] shadow-sm border border-stone-100 animate-in slide-in-from-left duration-500 sticky top-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-black text-stone-900 flex items-center gap-3">
                <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                  {editingEvent?.id ? <Edit3 size={20} /> : <Plus size={20} />} 
                </div>
                {editingEvent?.id ? dict.admin.editEvent : dict.admin.newEvent}
              </h2>
              <button onClick={handleCancel} className="p-2 hover:bg-stone-50 rounded-full transition text-stone-400">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.labelTitle} (CZ)</label>
                  <input {...register('title')} type="text" placeholder="Zadejte název akce..." className={`w-full border-none p-4 rounded-2xl outline-none ring-1 ring-stone-100 focus:ring-2 focus:ring-green-500 bg-stone-50/50 font-bold text-stone-700 transition ${errors.title ? 'ring-red-500 focus:ring-red-500' : ''}`} />
                  {errors.title && <p className="text-red-500 text-[10px] font-bold px-1">{errors.title.message as string}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.labelTitleEn || 'Event Title'} (EN)</label>
                  <input {...register('title_en')} type="text" placeholder="Enter event title..." className={`w-full border-none p-4 rounded-2xl outline-none ring-1 ring-stone-100 focus:ring-2 focus:ring-green-500 bg-stone-50/50 font-bold text-stone-700 transition ${errors.title_en ? 'ring-red-500 focus:ring-red-500' : ''}`} />
                  {errors.title_en && <p className="text-red-500 text-[10px] font-bold px-1">{errors.title_en.message as string}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.labelPublishedAt || 'Datum zveřejnění'}</label>
                      <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-stone-500">
                        <input
                          type="checkbox"
                          checked={isDraft}
                          onChange={(e) => {
                            if (e.target.checked) setValue('published_at', '');
                          }}
                          className="w-4 h-4 accent-green-600 rounded border-stone-300"
                        />
                        {dict.admin.labelDraft || 'Koncept'}
                      </label>
                    </div>
                    <input
                      {...register('published_at')}
                      type="datetime-local"
                      disabled={isDraft}
                      className="w-full border-none p-4 rounded-2xl outline-none ring-1 ring-stone-100 focus:ring-2 focus:ring-green-500 bg-stone-50/50 font-bold text-stone-700 transition disabled:opacity-50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.labelTicketSaleEnd || 'Konec prodeje'}</label>
                    <input {...register('ticket_sale_end')} type="datetime-local" className="w-full border-none p-4 rounded-2xl outline-none ring-1 ring-stone-100 focus:ring-2 focus:ring-green-500 bg-stone-50/50 font-bold text-stone-700 transition" />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Den konání</label>
                    <input {...register('date')} type="date" className={`w-full border-none p-4 rounded-2xl outline-none ring-1 ring-stone-100 focus:ring-2 focus:ring-green-500 bg-stone-50/50 font-bold text-stone-700 transition ${errors.date ? 'ring-red-500 focus:ring-red-500' : ''}`} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.time || 'Čas'}</label>
                    <input {...register('time')} type="time" className={`w-full border-none p-4 rounded-2xl outline-none ring-1 ring-stone-100 focus:ring-2 focus:ring-green-500 bg-stone-50/50 font-bold text-stone-700 transition ${errors.time ? 'ring-red-500 focus:ring-red-500' : ''}`} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.labelLocation}</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                    <input {...register('location')} type="text" placeholder="Kde se akce koná?" className={`w-full border-none pl-12 pr-4 py-4 rounded-2xl outline-none ring-1 ring-stone-100 focus:ring-2 focus:ring-green-500 bg-stone-50/50 font-bold text-stone-700 transition ${errors.location ? 'ring-red-500 focus:ring-red-500' : ''}`} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.labelCapacity || 'Kapacita'}</label>
                    <input {...register('capacity', { valueAsNumber: true })} type="number" placeholder="∞" className="w-full border-none p-4 rounded-2xl outline-none ring-1 ring-stone-100 focus:ring-2 focus:ring-green-500 bg-stone-50/50 font-bold text-stone-700 transition" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Kategorie</label>
                    <select {...register('category')} className="w-full border-none p-4 rounded-2xl outline-none ring-1 ring-stone-100 focus:ring-2 focus:ring-green-500 bg-stone-50/50 font-bold text-stone-700 transition appearance-none">
                      <option value="Párty">{dict.categories['Párty']}</option>
                      <option value="Vzdělávání">{dict.categories['Vzdělávání']}</option>
                      <option value="Výlet">{dict.categories['Výlet']}</option>
                      <option value="Zábava">{dict.categories['Zábava']}</option>
                    </select>
                  </div>
                </div>

                <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input {...register('is_member_only')} type="checkbox" className="w-5 h-5 accent-green-600 rounded-lg border-stone-300" />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-stone-700">{dict.admin.labelIsMemberOnly || 'Pouze pro členy'}</span>
                      <span className="text-[10px] text-stone-400 font-medium">Akce bude viditelná pouze v členské sekci</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.labelDesc} (CZ)</label>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if ((description || '').trim()) return;
                        setValue(
                          'description',
                          draftEventDescriptionHtmlCz({ title: title || 'Akce', date, time, location, category, isMemberOnly })
                        );
                      }}
                      className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
                    >
                      Návrh
                    </button>
                  </div>
                  <Editor value={description} onChange={(val) => setValue('description', val)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.labelDescEn} (EN)</label>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if ((titleEn || '').trim()) return;
                        setValue('title_en', suggestEnglishText(title || ''));
                      }}
                      className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
                    >
                      Title EN
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if ((descriptionEn || '').trim()) return;
                        setValue(
                          'description_en',
                          draftEventDescriptionHtmlEn({
                            title: (titleEn || suggestEnglishText(title || '') || title || 'Event').trim(),
                            date,
                            time,
                            location,
                            category,
                            isMemberOnly,
                          })
                        );
                      }}
                      className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
                    >
                      Návrh EN
                    </button>
                  </div>
                  <Editor value={descriptionEn} onChange={(val) => setValue('description_en', val)} />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Obrázek akce</label>
                <div className="border-2 border-dashed border-stone-200 rounded-[2rem] p-8 text-center cursor-pointer relative group hover:border-green-400 hover:bg-green-50/30 transition-all duration-300">
                    <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                    <div className="flex flex-col items-center text-stone-400 group-hover:text-green-600 transition-colors">
                      <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-white group-hover:shadow-md transition-all">
                        <ImageIcon size={32} />
                      </div>
                      {imageFile ? (
                        <span className="font-bold text-sm text-green-600 break-all">{imageFile.name}</span>
                      ) : (
                        <>
                          <span className="text-sm font-bold text-stone-600 mb-1">{dict.admin.clickUpload}</span>
                          <span className="text-[10px] font-medium">PNG, JPG nebo WEBP (max. 5MB)</span>
                        </>
                      )}
                    </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Fotky k události</label>
                {!editingEvent?.id ? (
                  <div className="p-6 bg-stone-50 rounded-[2rem] border border-stone-100 text-stone-500 font-medium text-sm">
                    Nejdřív ulož akci, potom lze nahrávat fotky.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="border-2 border-dashed border-stone-200 rounded-[2rem] p-6 text-center relative hover:border-green-400 hover:bg-green-50/30 transition-all">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => setEventPhotoFiles(Array.from(e.target.files || []))}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <div className="text-stone-600 font-bold">
                        {eventPhotoFiles.length > 0 ? `${eventPhotoFiles.length} souborů vybráno` : 'Klikni pro výběr více fotek'}
                      </div>
                      <div className="text-[10px] text-stone-400 font-medium mt-1">PNG, JPG nebo WEBP</div>
                    </div>

                    <button
                      type="button"
                      disabled={uploadEventPhotosMutation.isPending || eventPhotoFiles.length === 0}
                      onClick={() => uploadEventPhotosMutation.mutate()}
                      className="w-full bg-stone-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-green-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {uploadEventPhotosMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <ImageIcon size={16} />}
                      Nahrát fotky
                    </button>

                    {eventPhotos.length > 0 && (
                      <div className="grid grid-cols-3 gap-3">
                        {eventPhotos.slice(0, 12).map((p: any) => (
                          <div key={p.id} className="relative aspect-square rounded-2xl overflow-hidden border border-stone-100 bg-stone-50 group">
                            <Image src={p.image_url} alt="" fill className="object-cover" />
                            <button
                              type="button"
                              onClick={() => deleteEventPhotoMutation.mutate(p.id)}
                              className="absolute top-2 right-2 p-2 rounded-xl bg-white/90 border border-stone-100 text-stone-600 hover:text-red-600 hover:bg-red-50 transition opacity-0 group-hover:opacity-100"
                              disabled={deleteEventPhotoMutation.isPending}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {seo.length > 0 && (
                <div className="bg-stone-50 border border-stone-100 rounded-[2rem] p-6">
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3">SEO návrhy</div>
                  <div className="space-y-2">
                    {seo.map((s) => (
                      <div key={s} className="text-sm font-bold text-stone-700">
                        {s}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={handleCancel}
                  className="flex-1 py-4 bg-stone-100 text-stone-600 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-stone-200 transition-all"
                >
                  {dict.admin.btnCancel}
                </button>
                <button 
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="flex-[2] bg-green-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-green-700 transition-all shadow-lg shadow-green-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saveMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  {editingEvent?.id ? dict.admin.btnUpdateEvent : dict.admin.btnSaveEvent}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* LIST SECTION */}
        <div className={`${editingEvent ? 'lg:col-span-7 xl:col-span-8' : 'lg:col-span-12'} bg-white p-8 rounded-[2.5rem] border border-stone-100 shadow-sm overflow-hidden transition-all duration-500`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-stone-900">Seznam akcí</h2>
              <div className="ml-2 inline-flex rounded-xl border border-stone-200 bg-stone-50 p-1">
                <button
                  type="button"
                  onClick={() => setListView('active')}
                  className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition ${
                    listView === 'active' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  Aktivní
                </button>
                <button
                  type="button"
                  onClick={() => setListView('archive')}
                  className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition ${
                    listView === 'archive' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  Archiv
                </button>
              </div>
            </div>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
              <input 
                type="text" 
                placeholder="Hledat v seznamu..." 
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="pl-10 pr-4 py-2 bg-stone-50 border border-stone-100 rounded-xl text-sm font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition-all w-full md:w-64"
              />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left border-separate border-spacing-y-2">
              <thead>
                <tr className="text-stone-400">
                  <th className="px-4 py-2">
                    <input 
                      type="checkbox" 
                      onChange={(e) => setSelectedIds(e.target.checked ? filteredEvents.map(ev => ev.id) : [])}
                      checked={selectedIds.length === filteredEvents.length && filteredEvents.length > 0}
                      className="rounded-lg text-green-600 border-stone-200 w-5 h-5 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest">{dict.admin.labelTitle}</th>
                  <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest">{dict.admin.labelDate}</th>
                  <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest">{dict.admin.labelLocation}</th>
                  <th className="px-4 py-2 text-right text-[10px] font-black uppercase tracking-widest">{dict.admin.labelActions || 'Akce'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((event) => (
                  <tr key={event.id} className={`group transition-all duration-200 ${selectedIds.includes(event.id) ? 'bg-green-50/50' : 'hover:bg-stone-50/80'}`}>
                    <td className="px-4 py-4 rounded-l-2xl border-y border-l border-transparent group-hover:border-stone-100 transition-all">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(event.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedIds([...selectedIds, event.id]);
                          else setSelectedIds(selectedIds.filter(id => id !== event.id));
                        }}
                        className="rounded-lg text-green-600 border-stone-200 w-5 h-5 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-4 border-y border-transparent group-hover:border-stone-100 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="relative h-14 w-14 rounded-2xl overflow-hidden bg-stone-100 shadow-sm shrink-0">
                          {event.image_url ? (
                            <Image src={event.image_url} alt="" fill className="object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-stone-300">
                              <ImageIcon size={20} />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-black text-stone-900 text-base truncate">{event.title}</p>
                            {event.is_member_only && (
                              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[8px] font-black uppercase tracking-tighter">ČLEN</span>
                            )}
                            {getPublishState(event) === 'published' && (
                              <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[8px] font-black uppercase tracking-tighter">
                                PUB
                              </span>
                            )}
                            {getPublishState(event) === 'scheduled' && (
                              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[8px] font-black uppercase tracking-tighter">
                                PLÁN
                              </span>
                            )}
                            {getPublishState(event) === 'draft' && (
                              <span className="px-1.5 py-0.5 bg-stone-200 text-stone-700 rounded text-[8px] font-black uppercase tracking-tighter">
                                KONCEPT
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-stone-400 font-black uppercase tracking-widest flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            {dict.categories[event.category] || event.category}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 border-y border-transparent group-hover:border-stone-100 transition-all">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-stone-700 flex items-center gap-1.5"><CalendarIcon size={14} className="text-stone-400" /> {new Date(event.date).toLocaleDateString()}</span>
                        <span className="text-[10px] text-stone-400 font-bold ml-5 uppercase">{event.time}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 border-y border-transparent group-hover:border-stone-100 transition-all">
                      <div className="flex items-center gap-2 text-stone-500 text-sm font-medium">
                        <div className="w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center shrink-0">
                          <MapPin size={14} className="text-stone-400" />
                        </div>
                        <span className="truncate max-w-[120px]">{event.location}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 rounded-r-2xl border-y border-r border-transparent group-hover:border-stone-100 transition-all text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!readOnly && (
                          <>
                            {getPublishState(event) === 'scheduled' && (
                              <button
                                onClick={() => askTogglePublish(event, 'clear_schedule')}
                                className="p-2.5 text-stone-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                                title="Zrušit plán"
                                disabled={publishMutation.isPending}
                              >
                                <CalendarClock size={18} />
                              </button>
                            )}
                            <button
                              onClick={() => askTogglePublish(event)}
                              className="p-2.5 text-stone-400 hover:text-stone-900 hover:bg-stone-50 rounded-xl transition-all"
                              title={getPublishState(event) === 'published' ? 'Zrušit publikaci' : 'Publikovat teď'}
                              disabled={publishMutation.isPending}
                            >
                              {getPublishState(event) === 'published' ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                          </>
                        )}
                        {!readOnly && (
                          <button
                            onClick={() => advanceWaitlist(event.id, 'manual_admin')}
                            className="p-2.5 text-stone-400 hover:text-violet-700 hover:bg-violet-50 rounded-xl transition-all"
                            title={dict.admin?.waitlist?.advanceNow || 'Posunout čekací listinu'}
                            disabled={advancingEventId === event.id}
                          >
                            {advancingEventId === event.id ? <Loader2 size={18} className="animate-spin" /> : <ChevronsUp size={18} />}
                          </button>
                        )}
                        <button 
                          onClick={() => exportRSVP(event.id, event.title)} 
                          className="p-2.5 text-stone-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all" 
                          title="Export účastníků"
                        >
                          <Download size={18} />
                        </button>
                        <button 
                          onClick={() => handleEdit(event)} 
                          className="p-2.5 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                        >
                          <Edit3 size={18} />
                        </button>
                        {listView === 'archive' ? (
                          <button
                            onClick={() => askRestore([event.id])}
                            className="p-2.5 text-stone-400 hover:text-stone-900 hover:bg-stone-50 rounded-xl transition-all"
                            title="Vrátit z archivu"
                            disabled={archiveMutation.isPending}
                          >
                            <RotateCcw size={18} />
                          </button>
                        ) : (
                          <button
                            onClick={() => askArchive([event.id])}
                            className="p-2.5 text-stone-400 hover:text-stone-900 hover:bg-stone-50 rounded-xl transition-all"
                            title="Archivovat"
                            disabled={archiveMutation.isPending}
                          >
                            <Archive size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
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
