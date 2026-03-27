'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/lib/supabase';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Plus, Trash2, Edit3, Image as ImageIcon, Calendar as CalendarIcon, MapPin, Clock, Download, Loader2, Save, X, Eye, EyeOff, CalendarClock } from 'lucide-react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useToast } from '../../../../context/ToastContext';
import { logAdminAction } from '@/lib/admin-logger';
import ConfirmModal from '@/app/components/ConfirmModal';
import { draftEventDescriptionHtmlCz, draftEventDescriptionHtmlEn, seoSuggestions, suggestEnglishText } from '@/lib/ai/pilot';
import AdminModuleHeader from './ui/AdminModuleHeader';

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
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ title: string; message: string; onConfirm: () => void }>({
    title: '',
    message: '',
    onConfirm: () => {}
  });

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
    return ts <= Date.now() ? 'published' : 'scheduled';
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

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<any>({
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

  const description = watch('description');
  const descriptionEn = watch('description_en');
  const title = watch('title');
  const titleEn = watch('title_en');
  const date = watch('date');
  const time = watch('time');
  const location = watch('location');
  const category = watch('category');
  const isMemberOnly = watch('is_member_only');
  const publishedAt = watch('published_at');
  const isDraft = !String(publishedAt || '').trim();

  const seo = seoSuggestions({
    title: title || '',
    descriptionHtml: description || '',
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
        const { ticket_sale_end: _drop, ...rest } = payload as any;
        return rest;
      };

      if (editingEvent?.id) {
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setModalOpen(false);
      showToast(dict.admin.confirmDeleteSuccess || 'Smazáno', 'success');
    },
    onError: (err: any) => {
      showToast(err.message, 'error');
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('events').delete().in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setSelectedIds([]);
      showToast('Vybrané akce smazány', 'success');
    },
    onError: (err: any) => showToast(err.message, 'error')
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

  const deleteItem = (id: string) => {
    setModalConfig({
      title: dict.admin.confirmDeleteEventTitle || 'Smazat akci?',
      message: dict.admin.confirmDeleteEvent || 'Opravdu chcete tuto akci trvale smazat? Tato operace je nevratná.',
      onConfirm: () => deleteMutation.mutate(id)
    });
    setModalOpen(true);
  };

  const handleBulkDelete = () => {
    setModalConfig({
      title: dict.admin.bulkDeleteTitle || 'Smazat vybrané?',
      message: (dict.admin.bulkDeleteConfirm || 'Opravdu chcete smazat {count} vybraných akcí?').replace('{count}', selectedIds.length.toString()),
      onConfirm: () => bulkDeleteMutation.mutate(selectedIds)
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

  const filteredEvents = events.filter(ev => 
    ev.title.toLowerCase().includes(localSearch.toLowerCase()) || 
    ev.location.toLowerCase().includes(localSearch.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <AdminModuleHeader
        title={dict.admin.tabEvents}
        description="Správa a plánování akcí pro studenty a členy"
        actions={
          <>
            {selectedIds.length > 0 && (
              <button 
                onClick={handleBulkDelete} 
                className="bg-red-50 text-red-600 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-red-600 hover:text-white transition-all shadow-sm"
              >
                <Trash2 size={16} /> {dict.admin.btnDelete} ({selectedIds.length})
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
            <h2 className="text-xl font-black text-stone-900">Seznam akcí</h2>
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
                        <button 
                          onClick={() => deleteItem(event.id)} 
                          className="p-2.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
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
