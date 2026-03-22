'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Circle, Compass, Settings, ShieldCheck, Sparkles } from 'lucide-react';

type ManualState = Record<string, boolean>;

function readManual(key: string): ManualState {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeManual(key: string, value: ManualState) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export default function OnboardingCard({
  lang,
  userId,
  profile,
  onNavigate,
}: {
  lang: string;
  userId: string;
  profile: any;
  onNavigate: (tab: string) => void;
}) {
  const isEn = lang === 'en';
  const storageKey = `pupen_onboarding_v1:${userId}`;
  const [manual, setManual] = useState<ManualState>({});

  useEffect(() => {
    setManual(readManual(storageKey));
  }, [storageKey]);

  const auto = useMemo(() => {
    const hasName = !!(profile?.first_name && profile?.last_name);
    const hasAvatar = !!profile?.avatar_url;
    return { hasName, hasAvatar };
  }, [profile?.avatar_url, profile?.first_name, profile?.last_name]);

  const items = useMemo(() => {
    return [
      {
        id: 'profile_name',
        label: isEn ? 'Fill in your profile name' : 'Vyplnit profil (jméno)',
        done: auto.hasName,
        actionLabel: isEn ? 'Profile' : 'Profil',
        onAction: () => onNavigate('settings'),
        icon: Settings,
      },
      {
        id: 'profile_avatar',
        label: isEn ? 'Upload an avatar' : 'Nahrát avatar',
        done: auto.hasAvatar,
        actionLabel: isEn ? 'Profile' : 'Profil',
        onAction: () => onNavigate('settings'),
        icon: Settings,
      },
      {
        id: 'read_guidelines',
        label: isEn ? 'Read community guidelines' : 'Přečíst pravidla komunity',
        done: !!manual.read_guidelines,
        actionLabel: isEn ? 'Open' : 'Otevřít',
        onAction: () => onNavigate('guidelines'),
        icon: ShieldCheck,
      },
      {
        id: 'check_notifications',
        label: isEn ? 'Check notification preferences' : 'Zkontrolovat notifikace',
        done: !!manual.check_notifications,
        actionLabel: isEn ? 'Open' : 'Otevřít',
        onAction: () => onNavigate('notifications'),
        icon: Sparkles,
      },
      {
        id: 'explore_projects',
        label: isEn ? 'Explore projects' : 'Prohlédnout projekty',
        done: !!manual.explore_projects,
        actionLabel: isEn ? 'Open' : 'Otevřít',
        onAction: () => onNavigate('projects'),
        icon: Compass,
      },
    ] as const;
  }, [auto.hasAvatar, auto.hasName, isEn, manual.check_notifications, manual.explore_projects, manual.read_guidelines, onNavigate]);

  const doneCount = items.filter((i) => i.done).length;
  const total = items.length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  if (total > 0 && doneCount >= total) return null;

  const toggleManual = (id: string) => {
    const next = { ...manual, [id]: !manual[id] };
    setManual(next);
    writeManual(storageKey, next);
  };

  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-stone-100 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-stone-300">
            {isEn ? 'Onboarding' : 'Začínáme'}
          </div>
          <h3 className="text-xl font-black text-stone-900 mt-2">
            {isEn ? 'Welcome to Pupen' : 'Vítejte v Pupenu'}
          </h3>
          <div className="mt-2 text-sm font-bold text-stone-600">
            {isEn ? `${pct}% completed` : `${pct}% hotovo`}
          </div>
        </div>
        <div className="w-14 h-14 rounded-2xl bg-green-50 border border-green-100 flex items-center justify-center text-green-700 font-black">
          {doneCount}/{total}
        </div>
      </div>

      <div className="mt-6 space-y-2">
        {items.map((i) => (
          <div key={i.id} className={`p-4 rounded-2xl border ${i.done ? 'bg-stone-50 border-stone-100' : 'bg-white border-green-200'}`}>
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  if (i.id === 'profile_name' || i.id === 'profile_avatar') return;
                  toggleManual(i.id);
                }}
                className="flex items-start gap-3 text-left flex-grow"
              >
                <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 ${i.done ? 'bg-white border-stone-100 text-stone-400' : 'bg-green-50 border-green-200 text-green-700'}`}>
                  {i.done ? <CheckCircle size={18} /> : <Circle size={18} />}
                </div>
                <div className="min-w-0">
                  <div className={`font-black ${i.done ? 'text-stone-500' : 'text-stone-900'}`}>{i.label}</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-300 mt-1">
                    {i.id === 'profile_name' || i.id === 'profile_avatar'
                      ? isEn
                        ? 'Auto'
                        : 'Automaticky'
                      : isEn
                        ? 'Click to mark done'
                        : 'Klikněte pro označení'}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={i.onAction}
                className="shrink-0 inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
              >
                <i.icon size={16} />
                {i.actionLabel}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
