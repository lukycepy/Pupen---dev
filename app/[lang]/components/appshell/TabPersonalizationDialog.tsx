'use client';

import React from 'react';
import Dialog from '@/app/components/ui/Dialog';
import { Eye, EyeOff, Pin, PinOff } from 'lucide-react';

export type PersonalizableTab = {
  id: string;
  label: string;
  group?: string;
};

export type TabPrefs = {
  defaultTab?: string;
  hiddenTabs?: string[];
  pinnedTabs?: string[];
};

function uniq(arr: string[]) {
  return Array.from(new Set(arr.map((x) => String(x))));
}

export default function TabPersonalizationDialog({
  open,
  onClose,
  title,
  tabs,
  initial,
  onSave,
  labels,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  tabs: PersonalizableTab[];
  initial: TabPrefs;
  onSave: (prefs: TabPrefs) => Promise<void> | void;
  labels?: { save?: string; cancel?: string; defaultTab?: string };
}) {
  const [defaultTab, setDefaultTab] = React.useState(String(initial?.defaultTab || ''));
  const [hiddenTabs, setHiddenTabs] = React.useState<string[]>(uniq((initial?.hiddenTabs || []).map(String)));
  const [pinnedTabs, setPinnedTabs] = React.useState<string[]>(uniq((initial?.pinnedTabs || []).map(String)));
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setDefaultTab(String(initial?.defaultTab || ''));
    setHiddenTabs(uniq((initial?.hiddenTabs || []).map(String)));
    setPinnedTabs(uniq((initial?.pinnedTabs || []).map(String)));
  }, [open, initial?.defaultTab, initial?.hiddenTabs, initial?.pinnedTabs]);

  const isHidden = (id: string) => hiddenTabs.includes(id);
  const isPinned = (id: string) => pinnedTabs.includes(id);

  const toggleHidden = (id: string) => {
    setHiddenTabs((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const togglePinned = (id: string) => {
    setPinnedTabs((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const grouped = React.useMemo(() => {
    const by = new Map<string, PersonalizableTab[]>();
    for (const t of tabs) {
      const g = String(t.group || '');
      const key = g || '—';
      const arr = by.get(key) || [];
      arr.push(t);
      by.set(key, arr);
    }
    return Array.from(by.entries()).map(([group, items]) => ({ group, items }));
  }, [tabs]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      overlayClassName="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[60000] flex items-center justify-center p-6 animate-in fade-in duration-300 text-left"
      panelClassName="bg-white w-full max-w-3xl max-h-[85vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
    >
      <div className="p-8 border-b border-stone-200 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">{labels?.defaultTab || 'Personalizace'}</div>
          <h2 className="text-xl font-black text-stone-900 truncate">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-2xl bg-stone-100 text-stone-800 text-[10px] font-black uppercase tracking-widest hover:bg-stone-200 transition"
            disabled={saving}
          >
            {labels?.cancel || 'Zrušit'}
          </button>
          <button
            type="button"
            onClick={async () => {
              setSaving(true);
              try {
                await onSave({ defaultTab: defaultTab || undefined, hiddenTabs: uniq(hiddenTabs), pinnedTabs: uniq(pinnedTabs) });
                onClose();
              } finally {
                setSaving(false);
              }
            }}
            className="h-10 px-4 rounded-2xl bg-green-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-green-700 transition disabled:opacity-50"
            disabled={saving}
          >
            {labels?.save || 'Uložit'}
          </button>
        </div>
      </div>

      <div className="p-8 overflow-y-auto custom-scrollbar space-y-6">
        <div className="bg-stone-50 border border-stone-200 rounded-[2rem] p-5">
          <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3">{labels?.defaultTab || 'Výchozí tab'}</div>
          <select
            value={defaultTab}
            onChange={(e) => setDefaultTab(e.target.value)}
            className="w-full bg-white border border-stone-200 rounded-2xl px-4 py-3 font-bold text-stone-700 outline-none"
          >
            <option value="">—</option>
            {tabs.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {grouped.map((g) => (
          <div key={g.group} className="space-y-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{g.group}</div>
            <div className="grid sm:grid-cols-2 gap-2">
              {g.items.map((t) => (
                <div key={t.id} className="bg-white border border-stone-200 rounded-[1.5rem] p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-black text-stone-900 truncate">{t.label}</div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 truncate">{t.id}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => togglePinned(t.id)}
                      className={
                        isPinned(t.id)
                          ? 'h-10 w-10 rounded-2xl bg-stone-900 text-white flex items-center justify-center'
                          : 'h-10 w-10 rounded-2xl bg-stone-100 text-stone-700 hover:bg-stone-200 flex items-center justify-center'
                      }
                      title={isPinned(t.id) ? 'Odepnout' : 'Připnout'}
                      aria-label={isPinned(t.id) ? 'Odepnout' : 'Připnout'}
                    >
                      {isPinned(t.id) ? <PinOff size={16} /> : <Pin size={16} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleHidden(t.id)}
                      className={
                        isHidden(t.id)
                          ? 'h-10 w-10 rounded-2xl bg-stone-900 text-white flex items-center justify-center'
                          : 'h-10 w-10 rounded-2xl bg-stone-100 text-stone-700 hover:bg-stone-200 flex items-center justify-center'
                      }
                      title={isHidden(t.id) ? 'Zobrazit' : 'Skrýt'}
                      aria-label={isHidden(t.id) ? 'Zobrazit' : 'Skrýt'}
                    >
                      {isHidden(t.id) ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Dialog>
  );
}

