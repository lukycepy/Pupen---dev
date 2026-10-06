'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Phone,
  Plus,
  Save,
  Trash2,
  Edit3,
  Search,
  Upload,
  Download,
  ExternalLink,
  FileJson,
  FileSpreadsheet,
  AlertTriangle,
  Check,
  X,
  RefreshCw,
} from 'lucide-react';
import AdminModuleHeader from './ui/AdminModuleHeader';
import AdminPanel from './ui/AdminPanel';
import InlinePulse from '@/app/components/InlinePulse';
import { useToast } from '@/app/context/ToastContext';
import {
  LinkaContact,
  nextContactId,
  contactMatches,
  CSV_HEADER,
  contactToCsvRow,
  parseCsv,
} from '@/lib/apps-linka/types';
import { supabase } from '@/lib/supabase';

type FormState = Omit<LinkaContact, 'id'> & { id?: number | '' };

const FIELD_LABELS: Record<keyof LinkaContact, string> = {
  id: 'ID',
  jmeno: 'Jméno a tituly',
  oddeleni: 'Oddělení / katedra',
  fakulta: 'Fakulta / orgán',
  budova: 'Budova / lokace',
  mistnost: 'Místnost',
  klapka: 'Linka (4 číslice)',
  email: 'E-mail',
};

const FIELD_PLACEHOLDERS: Record<keyof LinkaContact, string> = {
  id: '',
  jmeno: 'Ing. Jan Novák, Ph.D.',
  oddeleni: 'Katedra informatiky',
  fakulta: 'Fakulta agrobiologie, potravinových a přírodních zdrojů',
  budova: 'Kampus - Budova A',
  mistnost: 'A-301',
  klapka: '2001',
  email: 'jan.novák@fapp.czu.cz',
};

const EMPTY_FORM: FormState = {
  jmeno: '',
  oddeleni: '',
  fakulta: '',
  budova: '',
  mistnost: '',
  klapka: '',
  email: '',
};

export default function LinkaTab() {
  const { showToast } = useToast();

  const [contacts, setContacts] = useState<LinkaContact[]>([]);
  const [version, setVersion] = useState<number>(0);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [sourcePath, setSourcePath] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const [search, setSearch] = useState('');

  const [editing, setEditing] = useState<{ dirty: boolean; idx: number | null; form: FormState; errors: Record<string, string> }>({
    dirty: false,
    idx: null,
    form: { ...EMPTY_FORM },
    errors: {},
  });

  const [globalErrors, setGlobalErrors] = useState<string[]>([]);
  const [warnedEmpty, setWarnedEmpty] = useState(false);

  const importFileRef = useRef<HTMLInputElement | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setGlobalErrors([]);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Nepřihlášen');
      const res = await fetch('/api/admin/apps/linka', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Chyba načtení');
      const payload: any = json.data || {};
      setContacts(Array.isArray(payload.contacts) ? payload.contacts : []);
      setVersion(Number(payload.version) || 0);
      setLastUpdated(String(payload.lastUpdated || ''));
      setSourcePath(String(json.meta?.path || ''));
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    const base = [...contacts];
    base.sort((a, b) => {
      const x = String(a.jmeno || '').localeCompare(String(b.jmeno || ''), 'cs-CZ');
      if (x !== 0) return x;
      return Number(a.id) - Number(b.id);
    });
    if (!search.trim()) return base;
    return base.filter((c) => contactMatches(c, search));
  }, [contacts, search]);

  const validateField = (field: keyof LinkaContact, value: any, excludeId?: number): string => {
    const v = String(value || '').trim();
    switch (field) {
      case 'jmeno':
      case 'oddeleni':
      case 'fakulta':
      case 'budova':
        if (!v) return 'Povinné pole (max 200 znaků)';
        if (v.length > 200) return 'Max 200 znaků';
        return '';
      case 'mistnost':
        if (!v) return 'Povinné pole (max 100 znaků)';
        if (v.length > 100) return 'Max 100 znaků';
        return '';
      case 'klapka':
        if (!v) return 'Povinné pole (přesně 4 číslice)';
        if (!/^\d{4}$/.test(v)) return 'Musí být přesně 4 číslice';
        const dup = contacts.find((c, i) => c.klapka === v && c.id !== excludeId);
        if (dup) return `Linka ${v} už je obsazena (${dup.jmeno})`;
        return '';
      case 'email':
        if (!v) return 'Povinné pole';
        if (v.length > 200) return 'Max 200 znaků';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Neplatný e-mail';
        return '';
      default:
        return '';
    }
  };

  const startEdit = (contact: LinkaContact | null) => {
    setEditing({
      dirty: false,
      idx: contact ? contacts.findIndex((c) => c.id === contact.id) : null,
      form: contact
        ? {
            id: contact.id,
            jmeno: contact.jmeno,
            oddeleni: contact.oddeleni,
            fakulta: contact.fakulta,
            budova: contact.budova,
            mistnost: contact.mistnost,
            klapka: contact.klapka,
            email: contact.email,
          }
        : { ...EMPTY_FORM },
      errors: {},
    });
  };

  const cancelEdit = () => {
    setEditing({ dirty: false, idx: null, form: { ...EMPTY_FORM }, errors: {} });
  };

  const updateField = (field: keyof FormState, raw: string, validate = false) => {
    const next = { ...editing.form, [field]: raw };
    const errors = { ...editing.errors };
    if (validate) {
      const excludeId = editing.form.id ? Number(editing.form.id) : undefined;
      const err = validateField(field as any, raw, excludeId);
      if (err) errors[String(field)] = err;
      else delete errors[String(field)];
    } else {
      delete errors[String(field)];
    }
    setEditing({ ...editing, dirty: true, form: next, errors });
  };

  const validateForm = (): boolean => {
    const err: Record<string, string> = {};
    const excludeId = editing.form.id ? Number(editing.form.id) : undefined;
    for (const key of Object.keys(EMPTY_FORM) as (keyof FormState)[]) {
      const msg = validateField(key as any, editing.form[key], excludeId);
      if (msg) err[key] = msg;
    }
    setEditing({ ...editing, errors: err });
    return Object.keys(err).length === 0;
  };

  const commitEdit = () => {
    if (!validateForm()) {
      showToast('Opravte chyby ve formuláři', 'error');
      return;
    }
    const form = editing.form;
    const nextContacts = [...contacts];
    const cleaned: LinkaContact = {
      id: 0,
      jmeno: String(form.jmeno || '').trim(),
      oddeleni: String(form.oddeleni || '').trim(),
      fakulta: String(form.fakulta || '').trim(),
      budova: String(form.budova || '').trim(),
      mistnost: String(form.mistnost || '').trim(),
      klapka: String(form.klapka || '').trim(),
      email: String(form.email || '').trim().toLowerCase(),
    };

    if (editing.idx != null && editing.form.id) {
      const idx = nextContacts.findIndex((c) => c.id === Number(editing.form.id));
      if (idx >= 0) {
        nextContacts[idx] = { ...cleaned, id: Number(editing.form.id) };
        setContacts(nextContacts);
        setEditing({ dirty: false, idx: null, form: { ...EMPTY_FORM }, errors: {} });
        showToast('Změna uložena v paměti, nezapomeň vše dohromady ULOŽIT', 'info');
        return;
      }
    }

    const newId = nextContactId(nextContacts);
    nextContacts.push({ ...cleaned, id: newId });
    setContacts(nextContacts);
    setEditing({ dirty: false, idx: null, form: { ...EMPTY_FORM }, errors: {} });
    showToast('Kontakt přidán do paměti, nezapomeň vše dohromady ULOŽIT', 'info');
  };

  const deleteContact = (id: number) => {
    if (!confirm('Opravdu smazat tento kontakt?')) return;
    setContacts((prev) => prev.filter((c) => c.id !== id));
    showToast('Kontakt odstraněn z paměti, nezapomeň vše dohromady ULOŽIT', 'info');
  };

  const saveAll = async () => {
    setSaving(true);
    setGlobalErrors([]);
    setWarnedEmpty(false);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Nepřihlášen');
      const res = await fetch('/api/admin/apps/linka', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mode: 'save', contacts }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        const errs = Array.isArray(json?.errors) ? json.errors : [];
        setGlobalErrors(errs.length ? errs : [json?.error || 'Chyba při ukládání']);
        if (json?.contacts && Array.isArray(json.contacts) && json.contacts.length > 0) {
          setContacts(json.contacts);
        }
        showToast(errs[0] || json?.error || 'Chyba při ukládání', 'error');
        return;
      }
      setVersion(Number(json.version) || version + 1);
      setLastUpdated(String(json.lastUpdated || ''));
      if (Array.isArray(json?.data?.contacts)) {
        setContacts(json.data.contacts);
      }
      if (json.warnedEmpty) setWarnedEmpty(true);
      showToast(`Data uložena, nová verze ${json.version}`, 'success');
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setSaving(false);
    }
  };

  const downloadFile = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  const runExport = async (format: 'json' | 'csv') => {
    setExporting(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Nepřihlášen');
      const res = await fetch('/api/admin/apps/linka', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mode: 'export', format }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Chyba exportu');
      downloadFile(String(json.filename), String(json.content || ''), String(json.mime || 'text/plain'));
      showToast(`Export ${format.toUpperCase()} hotový`, 'success');
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setExporting(false);
    }
  };

  const triggerImport = () => {
    importFileRef.current?.click();
  };

  const onImportFile = async (file: File) => {
    const name = String(file.name || '').toLowerCase();
    const format: 'csv' | 'json' = name.endsWith('.csv') ? 'csv' : 'json';
    setImporting(true);
    try {
      const text = await file.text();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Nepřihlášen');
      const res = await fetch('/api/admin/apps/linka', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mode: 'import', format, content: text }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Chyba importu');
      const imported = Array.isArray(json?.preview) ? json.preview : [];
      if (!imported.length) {
        showToast('Import neobsahuje žádné platné záznamy', 'error');
        return;
      }
      const merged = [...contacts];
      const idMap = new Map<number, number>();
      for (const c of merged) idMap.set(Number(c.id), Number(c.id));
      let added = 0;
      let updated = 0;
      for (const c of imported) {
        const id = Number(c.id);
        const base: LinkaContact = {
          id: 0,
          jmeno: String(c.jmeno || '').trim(),
          oddeleni: String(c.oddeleni || '').trim(),
          fakulta: String(c.fakulta || '').trim(),
          budova: String(c.budova || '').trim(),
          mistnost: String(c.mistnost || '').trim(),
          klapka: String(c.klapka || '').trim(),
          email: String(c.email || '').trim().toLowerCase(),
        };
        if (Number.isFinite(id) && id > 0) {
          const idx = merged.findIndex((m) => m.id === id);
          if (idx >= 0) {
            merged[idx] = { ...base, id };
            updated++;
            continue;
          }
          idMap.set(id, id);
          merged.push({ ...base, id });
          added++;
          continue;
        }
        const newId = nextContactId(merged);
        merged.push({ ...base, id: newId });
        added++;
      }
      setContacts(merged);
      showToast(`Import: přidáno ${added}, upraveno ${updated} kontaktů v paměti. Prosím proveďte ULOŽIT.`, 'success');
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setImporting(false);
      if (importFileRef.current) importFileRef.current.value = '';
    }
  };

  const openPreview = () => {
    window.open('/apps/kontakty.json', '_blank', 'noopener,noreferrer');
  };

  const hasAny = contacts.length > 0;
  const countFiltered = filtered.length;

  return (
    <div className="space-y-8 pb-16">
      <AdminModuleHeader
        title="Aplikace Linka od Pupenu – kontakty"
        description={`Správa kontaktů pro mobilní aplikaci. Veřejný JSON je vždy dostupný na /apps/kontakty.json, i během odstávky webu.`}
        actions={
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="bg-stone-50 text-stone-800 px-5 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-stone-100 transition border border-stone-200 disabled:opacity-50"
            >
              {loading ? <InlinePulse className="bg-stone-200" size={16} /> : <RefreshCw size={18} />} Znovu načíst
            </button>
            <button
              type="button"
              onClick={openPreview}
              className="bg-stone-50 text-stone-800 px-5 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-stone-100 transition border border-stone-200"
            >
              <ExternalLink size={18} /> Náhled JSON
            </button>
            <button
              type="button"
              onClick={triggerImport}
              disabled={importing}
              className="bg-amber-50 text-amber-800 px-5 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-amber-100 transition border border-amber-200 disabled:opacity-50"
            >
              {importing ? <InlinePulse className="bg-amber-200" size={16} /> : <Upload size={18} />} Import CSV/JSON
            </button>
            <input
              ref={importFileRef}
              type="file"
              accept=".csv,.json,application/json,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImportFile(f);
              }}
            />
            <div className="flex rounded-2xl overflow-hidden border border-stone-200">
              <button
                type="button"
                onClick={() => runExport('json')}
                disabled={exporting}
                className="bg-white text-stone-800 px-5 py-3 font-bold flex items-center gap-2 hover:bg-stone-50 transition disabled:opacity-50"
              >
                {exporting ? <InlinePulse className="bg-stone-200" size={16} /> : <FileJson size={18} />} JSON
              </button>
              <div className="w-px bg-stone-200" />
              <button
                type="button"
                onClick={() => runExport('csv')}
                disabled={exporting}
                className="bg-white text-stone-800 px-5 py-3 font-bold flex items-center gap-2 hover:bg-stone-50 transition disabled:opacity-50"
              >
                {exporting ? <InlinePulse className="bg-stone-200" size={16} /> : <FileSpreadsheet size={18} />} CSV
              </button>
            </div>
            <button
              type="button"
              onClick={saveAll}
              disabled={saving || loading}
              className="bg-green-600 text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 hover:bg-green-700 transition shadow-lg shadow-green-600/20 disabled:opacity-50"
            >
              {saving ? <InlinePulse className="bg-green-200" size={16} /> : <Save size={18} />} ULOŽIT (verze {version || '?'})
            </button>
          </div>
        }
      />

      <AdminPanel className="p-6 md:p-8 rounded-[2.5rem] space-y-6">
        <div className="grid md:grid-cols-3 gap-4">
          <div className="p-5 rounded-[2rem] bg-green-50 border border-green-100">
            <div className="text-[10px] font-black uppercase tracking-widest text-green-600">Verze dat</div>
            <div className="text-green-900 font-black text-2xl mt-1">{version || 0}</div>
            <div className="text-green-700 font-bold text-xs mt-1">
              {lastUpdated ? 'Naposledy: ' + new Date(lastUpdated).toLocaleString('cs-CZ') : 'Zatím neuloženo'}
            </div>
          </div>
          <div className="p-5 rounded-[2rem] bg-blue-50 border border-blue-100">
            <div className="text-[10px] font-black uppercase tracking-widest text-blue-600">Počet kontaktů</div>
            <div className="text-blue-900 font-black text-2xl mt-1">{contacts.length}</div>
            <div className="text-blue-700 font-bold text-xs mt-1">
              Filtrováno: {countFiltered}
            </div>
          </div>
          <div className="p-5 rounded-[2rem] bg-stone-50 border border-stone-100">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-500">Cesta k souboru</div>
            <div className="text-stone-800 font-bold text-sm mt-1 break-all">
              {sourcePath || '— zatím neuvedeno'}
            </div>
          </div>
        </div>

        {warnedEmpty && (
          <div className="p-5 rounded-[2rem] bg-amber-50 border border-amber-200 flex items-start gap-3">
            <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
            <div>
              <div className="font-black text-amber-900">Upozornění: pole kontaktů je prázdné</div>
              <div className="font-bold text-amber-700 text-sm mt-1">
                Aplikace si poradí, ale uživatelé nemusí vidět žádné lince.
              </div>
            </div>
          </div>
        )}

        {globalErrors.length > 0 && (
          <div className="p-5 rounded-[2rem] bg-red-50 border border-red-200 space-y-1">
            <div className="font-black text-red-900 flex items-center gap-2">
              <AlertTriangle size={18} /> Chyby (nelze uložit)
            </div>
            {globalErrors.map((e, i) => (
              <div key={i} className="font-bold text-red-700 text-sm pl-7">• {e}</div>
            ))}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-3">
          <label className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Vyhledat v jménu, lince, katedře, místnosti, e-mailu… (bez diakritiky)"
              className="w-full pl-12 pr-4 py-4 rounded-2xl border border-stone-200 bg-white font-bold text-stone-800 placeholder-stone-400 focus:ring-2 focus:ring-green-500 outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => startEdit(null)}
            className="bg-green-50 text-green-700 px-6 py-4 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-green-100 transition border border-green-200"
          >
            <Plus size={18} /> Přidat kontakt
          </button>
        </div>

        <div className="space-y-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">
            Seznam kontaktů · {countFiltered} z {contacts.length}
          </div>
          {loading ? (
            <div className="p-10 rounded-[2rem] bg-stone-50 border border-stone-100 flex items-center gap-3 text-stone-500 font-bold">
              <InlinePulse className="bg-stone-200" size={20} /> Načítám data…
            </div>
          ) : countFiltered === 0 ? (
            <div className="p-10 rounded-[2rem] bg-stone-50 border border-stone-100 text-stone-600 font-bold text-center">
              {hasAny ? 'Žádné výsledky vyhledávání.' : 'Zatím zde nejsou žádné kontakty. Přidejte první tlačítkem nahoře.'}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-2 md:mx-0">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="text-left text-[10px] font-black uppercase tracking-widest text-stone-400">
                    <th className="py-3 px-3 md:px-4">Jméno</th>
                    <th className="py-3 px-3 md:px-4">Oddělení</th>
                    <th className="py-3 px-3 md:px-4">Fakulta</th>
                    <th className="py-3 px-3 md:px-4">Budova</th>
                    <th className="py-3 px-3 md:px-4">Místnost</th>
                    <th className="py-3 px-3 md:px-4">Linka</th>
                    <th className="py-3 px-3 md:px-4">E-mail</th>
                    <th className="py-3 px-3 md:px-4 text-right">Akce</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-stone-50 transition">
                      <td className="py-3 px-3 md:px-4 border-t border-stone-100 align-top">
                        <div className="font-black text-stone-900">{c.jmeno}</div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">#{c.id}</div>
                      </td>
                      <td className="py-3 px-3 md:px-4 border-t border-stone-100 align-top font-bold text-stone-700">{c.oddeleni}</td>
                      <td className="py-3 px-3 md:px-4 border-t border-stone-100 align-top font-bold text-stone-700">{c.fakulta}</td>
                      <td className="py-3 px-3 md:px-4 border-t border-stone-100 align-top font-bold text-stone-700">{c.budova}</td>
                      <td className="py-3 px-3 md:px-4 border-t border-stone-100 align-top font-bold text-stone-700">{c.mistnost}</td>
                      <td className="py-3 px-3 md:px-4 border-t border-stone-100 align-top">
                        <span className="inline-flex items-center gap-1 rounded-xl bg-green-50 border border-green-200 px-3 py-1 font-black text-green-800">
                          <Phone size={14} />{c.klapka}
                        </span>
                      </td>
                      <td className="py-3 px-3 md:px-4 border-t border-stone-100 align-top font-bold text-stone-700 break-all max-w-xs">{c.email}</td>
                      <td className="py-3 px-3 md:px-4 border-t border-stone-100 align-top text-right">
                        <div className="inline-flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(c)}
                            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-stone-100 text-stone-700 hover:bg-stone-200 transition font-bold"
                            aria-label="Upravit kontakt"
                          >
                            <Edit3 size={16} />
                            <span className="hidden sm:inline">Upravit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteContact(c.id)}
                            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-red-50 text-red-700 hover:bg-red-100 transition font-bold"
                            aria-label="Smazat kontakt"
                          >
                            <Trash2 size={16} />
                            <span className="hidden sm:inline">Smazat</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </AdminPanel>

      {(editing.idx != null || editing.dirty || Object.keys(editing.form).some((k) => (editing.form as any)[k])) && (
        <AdminPanel className="p-6 md:p-8 rounded-[2.5rem] space-y-6 border-green-300">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 text-stone-900">
              <div className="w-12 h-12 rounded-2xl bg-green-50 border border-green-200 flex items-center justify-center text-green-700">
                <Phone size={22} />
              </div>
              <div>
                <div className="font-black text-xl">
                  {editing.idx != null || editing.form.id ? 'Upravit kontakt' : 'Přidat nový kontakt'}
                </div>
                <div className="font-bold text-stone-500 text-sm">
                  Pole označená jako povinná. Uložení tlačítkem níže přidá kontakt do paměti, nezapomeň hlavní ULOŽIT.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={cancelEdit}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-stone-50 text-stone-700 hover:bg-stone-100 transition font-bold border border-stone-200"
            >
              <X size={16} /> Zavřít
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {(['jmeno', 'oddeleni', 'fakulta', 'budova', 'mistnost', 'klapka', 'email'] as const).map((key) => {
              const value: string = String((editing.form as any)[key] || '');
              const err = editing.errors[key];
              return (
                <div key={key} className={key === 'email' ? 'md:col-span-2' : ''}>
                  <label className="flex items-center justify-between px-1 mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                      {FIELD_LABELS[key]}
                      <span className="text-red-500 ml-1">*</span>
                    </span>
                    {err ? <span className="text-red-600 font-bold text-xs">{err}</span> : null}
                  </label>
                  <input
                    type={key === 'email' ? 'email' : 'text'}
                    inputMode={key === 'klapka' ? 'numeric' : undefined}
                    maxLength={key === 'mistnost' ? 100 : 200}
                    value={value}
                    onChange={(e) => updateField(key, e.target.value, false)}
                    onBlur={(e) => updateField(key, e.target.value, true)}
                    placeholder={FIELD_PLACEHOLDERS[key]}
                    className={`w-full rounded-2xl px-5 py-4 border font-bold text-stone-800 outline-none transition ${
                      err
                        ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-400'
                        : 'border-stone-200 bg-white focus:ring-2 focus:ring-green-500'
                    }`}
                  />
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={cancelEdit}
              className="px-6 py-3 rounded-2xl bg-stone-100 text-stone-700 hover:bg-stone-200 transition font-black"
            >
              Zrušit
            </button>
            <button
              type="button"
              onClick={commitEdit}
              className="px-8 py-3 rounded-2xl bg-green-600 text-white hover:bg-green-700 transition font-black shadow-lg shadow-green-600/20 flex items-center gap-2"
            >
              <Check size={18} />
              {editing.idx != null || editing.form.id ? 'Uložit změny' : 'Přidat do seznamu'}
            </button>
          </div>
        </AdminPanel>
      )}

      <footer className="pt-2">
        <div className="text-center text-xs font-bold text-stone-500">
          Správa kontaktů pro aplikaci Linka od Pupenu · © Studentský spolek Pupen, z.s.
        </div>
      </footer>
    </div>
  );
}
