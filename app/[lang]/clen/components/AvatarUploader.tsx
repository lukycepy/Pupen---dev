'use client';

import React, { useState } from 'react';
import { Image as ImageIcon, Upload } from 'lucide-react';
import InlinePulse from '@/app/components/InlinePulse';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/app/context/ToastContext';
import Image from 'next/image';
import { useDictionary } from '@/app/context/DictionaryContext';

export default function AvatarUploader(props: {
  lang: string;
  userId: string;
  currentUrl?: string | null;
  onUploaded: (url: string) => void;
}) {
  const { currentUrl, onUploaded } = props;
  const dict = useDictionary();
  const t = dict.memberComponents.avatarUploader;
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  const onFileChange = async (file: File | null) => {
    if (!file) return;
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Unauthorized');

      const form = new FormData();
      form.set('file', file);

      const res = await fetch('/api/upload/avatar', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Upload failed');

      const url = String(json?.publicUrl || '');
      if (!url) throw new Error('Upload failed');

      onUploaded(url);
      showToast(t.toastUpdated, 'success');
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : '';
      if (msg.toLowerCase().includes('unauthorized')) {
        showToast(t.toastSignInAgain, 'info');
      } else if (msg.toLowerCase().includes('avatar_url')) {
        showToast(t.toastNotEnabled, 'info');
      } else {
        showToast(t.toastUploadFailed, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-stone-50 border border-stone-100 rounded-[2rem] p-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">
            {t.title}
          </div>
          <div className="text-sm font-bold text-stone-700">
            {t.subtitle}
          </div>
        </div>
        <div className="w-14 h-14 bg-white border border-stone-100 rounded-2xl overflow-hidden flex items-center justify-center text-stone-300 shadow-sm">
          {currentUrl ? (
            <Image src={currentUrl} alt="Avatar" width={56} height={56} className="w-full h-full object-cover" />
          ) : (
            <ImageIcon size={22} />
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:items-center">
        <label className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition cursor-pointer">
          {loading ? <InlinePulse className="bg-stone-300" size={12} /> : <Upload size={16} />}
          {t.chooseFile}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onFileChange(e.target.files?.[0] || null)}
            disabled={loading}
          />
        </label>
        <div className="text-[10px] font-black uppercase tracking-widest text-stone-300">
          PNG/JPG/WebP
        </div>
      </div>
    </div>
  );
}
