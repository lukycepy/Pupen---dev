'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Shield, Plus, Save, Trash2, Download } from 'lucide-react';
import InlinePulse from '@/app/components/InlinePulse';
import { useToast } from '@/app/context/ToastContext';
import { supabase } from '@/lib/supabase';
import { normalizeEntryValue } from '@/lib/tickets/blacklist';
import { useQuery } from '@tanstack/react-query';
import { DEFAULT_TICKET_SECURITY_CONFIG, normalizeTicketSecurityConfig } from '@/lib/tickets/securityConfig';

type Entry = { value: string; note?: string };

export default function TicketSecurityTab({ dict }: { dict: any }) {
  const { showToast } = useToast();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [newNote, setNewNote] = useState('');
  const [configDraft, setConfigDraft] = useState(DEFAULT_TICKET_SECURITY_CONFIG);
  const [configUpdatedAt, setConfigUpdatedAt] = useState<string | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  const addEntry = useCallback(
    (value: string, note?: string) => {
      const v = normalizeEntryValue(value);
      if (!v) return;
      setEntries((prev) => [{ value: v, note: note ? String(note).trim() : '' }, ...(prev || [])]);
    },
    [setEntries]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch('/api/admin/tickets/blacklist', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      setEntries(Array.isArray(json.entries) ? json.entries : []);
      setUpdatedAt(json.updatedAt || null);
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const loadConfig = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch('/api/admin/tickets/security-config', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      setConfigDraft(json?.config ? normalizeTicketSecurityConfig(json.config) : DEFAULT_TICKET_SECURITY_CONFIG);
      setConfigUpdatedAt(json?.updatedAt || null);
    } catch {}
  }, []);

  useEffect(() => {
    load();
    loadConfig();
  }, [load, loadConfig]);

  const normalized = useMemo(() => {
    const map = new Map<string, Entry>();
    for (const e of entries || []) {
      const value = normalizeEntryValue(e?.value || '');
      const note = e?.note ? String(e.note).trim() : '';
      if (!value) continue;
      if (!map.has(value)) map.set(value, { value, note });
    }
    return Array.from(map.values());
  }, [entries]);

  const sinceIso = useMemo(() => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), []);
  const { data: activity = [], isLoading: activityLoading, refetch: refetchActivity } = useQuery({
    queryKey: ['ticket_security_activity', sinceIso],
    queryFn: async () => {
      const res = await supabase
        .from('admin_logs')
        .select('id, created_at, action, target_id, details')
        .in('action', ['RSVP_ATTEMPT', 'RSVP_BLOCKED'])
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false })
        .limit(500);
      if (res.error) throw res.error;
      return res.data || [];
    },
  });

  const activityStats = useMemo(() => {
    const byIp = new Map<string, { ip: string; attempts: number; blocked: number; emails: Set<string>; lastAt: string }>();
    const byEmail = new Map<string, { email: string; attempts: number; blocked: number; events: Set<string>; ips: Set<string>; lastAt: string }>();
    const blockedRows: any[] = [];

    for (const row of activity as any[]) {
      const d = row.details || {};
      const ip = d.ip ? String(d.ip) : '';
      const email = d.email ? String(d.email).toLowerCase() : '';
      const eventId = d.eventId ? String(d.eventId) : row.target_id ? String(row.target_id) : '';
      const at = row.created_at ? String(row.created_at) : '';

      if (row.action === 'RSVP_BLOCKED') blockedRows.push(row);

      if (ip) {
        const cur = byIp.get(ip) || { ip, attempts: 0, blocked: 0, emails: new Set<string>(), lastAt: at };
        if (row.action === 'RSVP_ATTEMPT') cur.attempts += 1;
        if (row.action === 'RSVP_BLOCKED') cur.blocked += 1;
        if (email) cur.emails.add(email);
        if (at && (!cur.lastAt || new Date(at) > new Date(cur.lastAt))) cur.lastAt = at;
        byIp.set(ip, cur);
      }

      if (email) {
        const cur = byEmail.get(email) || { email, attempts: 0, blocked: 0, events: new Set<string>(), ips: new Set<string>(), lastAt: at };
        if (row.action === 'RSVP_ATTEMPT') cur.attempts += 1;
        if (row.action === 'RSVP_BLOCKED') cur.blocked += 1;
        if (eventId) cur.events.add(eventId);
        if (ip) cur.ips.add(ip);
        if (at && (!cur.lastAt || new Date(at) > new Date(cur.lastAt))) cur.lastAt = at;
        byEmail.set(email, cur);
      }
    }

    const topIps = Array.from(byIp.values())
      .sort((a, b) => b.attempts - a.attempts || b.emails.size - a.emails.size)
      .slice(0, 12);
    const topEmails = Array.from(byEmail.values())
      .sort((a, b) => b.attempts - a.attempts || b.events.size - a.events.size)
      .slice(0, 12);
    const recentBlocked = blockedRows.slice(0, 20);

    return { topIps, topEmails, recentBlocked };
  }, [activity]);

  const domainSuggestions = useMemo(() => {
    const existingDomains = new Set(
      normalized
        .map((e) => String(e.value || '').trim().toLowerCase())
        .filter((v) => v && !v.includes('@'))
    );
    const byDomain = new Map<string, { domain: string; attempts: number; blocked: number; emails: Set<string>; ips: Set<string>; lastAt: string }>();
    for (const row of activity as any[]) {
      const d = row.details || {};
      const email = d.email ? String(d.email).toLowerCase() : '';
      const at = email.lastIndexOf('@');
      const domain = at >= 0 ? email.slice(at + 1) : '';
      if (!domain) continue;
      const ip = d.ip ? String(d.ip) : '';
      const when = row.created_at ? String(row.created_at) : '';
      const cur = byDomain.get(domain) || { domain, attempts: 0, blocked: 0, emails: new Set<string>(), ips: new Set<string>(), lastAt: when };
      if (row.action === 'RSVP_ATTEMPT') cur.attempts += 1;
      if (row.action === 'RSVP_BLOCKED') cur.blocked += 1;
      if (email) cur.emails.add(email);
      if (ip) cur.ips.add(ip);
      if (when && (!cur.lastAt || new Date(when) > new Date(cur.lastAt))) cur.lastAt = when;
      byDomain.set(domain, cur);
    }

    const minAttempts = configDraft.domainSuggest.minAttempts;
    const minDistinctEmails = configDraft.domainSuggest.minDistinctEmails;
    return Array.from(byDomain.values())
      .filter((d) => d.attempts >= minAttempts && d.emails.size >= minDistinctEmails && !existingDomains.has(d.domain))
      .sort((a, b) => b.attempts - a.attempts || b.emails.size - a.emails.size)
      .slice(0, 12);
  }, [activity, configDraft.domainSuggest.minAttempts, configDraft.domainSuggest.minDistinctEmails, normalized]);

  const activityByEmail = useMemo(() => {
    const map = new Map<
      string,
      { email: string; attempts: number; blocked: number; events: Set<string>; ips: Set<string>; lastAt: string }
    >();
    for (const row of activity as any[]) {
      const d = row.details || {};
      const email = d.email ? String(d.email).toLowerCase() : '';
      if (!email) continue;
      const ip = d.ip ? String(d.ip) : '';
      const eventId = d.eventId ? String(d.eventId) : row.target_id ? String(row.target_id) : '';
      const at = row.created_at ? String(row.created_at) : '';

      const cur = map.get(email) || { email, attempts: 0, blocked: 0, events: new Set<string>(), ips: new Set<string>(), lastAt: at };
      if (row.action === 'RSVP_ATTEMPT') cur.attempts += 1;
      if (row.action === 'RSVP_BLOCKED') cur.blocked += 1;
      if (eventId) cur.events.add(eventId);
      if (ip) cur.ips.add(ip);
      if (at && (!cur.lastAt || new Date(at) > new Date(cur.lastAt))) cur.lastAt = at;
      map.set(email, cur);
    }
    return map;
  }, [activity]);

  const sinceNoShowIso = useMemo(() => new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(), []);
  const { data: noShowLogs = [], isLoading: noShowLoading } = useQuery({
    queryKey: ['ticket_no_show_logs', sinceNoShowIso],
    queryFn: async () => {
      const res = await supabase
        .from('admin_logs')
        .select('id, created_at, action, target_id, details')
        .in('action', ['NO_SHOW', 'NO_SHOW_UNDO'])
        .gte('created_at', sinceNoShowIso)
        .order('created_at', { ascending: false })
        .limit(2000);
      if (res.error) throw res.error;
      return res.data || [];
    },
  });

  const noShowStats = useMemo(() => {
    const lastByKey = new Map<string, any>();
    for (const row of noShowLogs as any[]) {
      const d = row.details || {};
      const rsvpId = d.rsvpId ? String(d.rsvpId) : '';
      const eventId = row.target_id ? String(row.target_id) : d.eventId ? String(d.eventId) : '';
      if (!rsvpId || !eventId) continue;
      const key = `${eventId}:${rsvpId}`;
      if (!lastByKey.has(key)) lastByKey.set(key, row);
    }

    const byEmail = new Map<string, { email: string; count: number; lastAt: string; events: Set<string> }>();
    for (const row of lastByKey.values()) {
      if (row.action !== 'NO_SHOW') continue;
      const d = row.details || {};
      const email = d.email ? String(d.email).toLowerCase() : '';
      if (!email) continue;
      const eventId = row.target_id ? String(row.target_id) : '';
      const at = row.created_at ? String(row.created_at) : '';
      const cur = byEmail.get(email) || { email, count: 0, lastAt: at, events: new Set<string>() };
      cur.count += 1;
      if (eventId) cur.events.add(eventId);
      if (at && (!cur.lastAt || new Date(at) > new Date(cur.lastAt))) cur.lastAt = at;
      byEmail.set(email, cur);
    }

    const top = Array.from(byEmail.values())
      .sort((a, b) => b.count - a.count || b.events.size - a.events.size)
      .slice(0, 20);

    return { top, totalNoShows: Array.from(byEmail.values()).reduce((acc, x) => acc + x.count, 0) };
  }, [noShowLogs]);

  const noShowByEmail = useMemo(() => {
    const map = new Map<string, { email: string; count: number; lastAt: string; events: Set<string> }>();
    for (const r of noShowStats.top) {
      map.set(r.email, r);
    }
    return map;
  }, [noShowStats.top]);

  const repeatOffenders = useMemo(() => {
    const emails = new Set<string>([...activityByEmail.keys(), ...noShowByEmail.keys()]);
    const rows: Array<{
      email: string;
      score: number;
      attempts24h: number;
      blocked24h: number;
      events24h: number;
      ips24h: number;
      noShow180d: number;
      noShowEvents180d: number;
      last24hAt: string;
      lastNoShowAt: string;
    }> = [];

    for (const email of emails) {
      const a = activityByEmail.get(email);
      const n = noShowByEmail.get(email);
      const attempts24h = a?.attempts || 0;
      const blocked24h = a?.blocked || 0;
      const events24h = a?.events?.size || 0;
      const ips24h = a?.ips?.size || 0;
      const noShow180d = n?.count || 0;
      const noShowEvents180d = n?.events?.size || 0;

      const score = attempts24h * 1 + blocked24h * 3 + noShow180d * 5 + (noShowEvents180d >= 2 ? 2 : 0) + (ips24h >= 2 ? 1 : 0);
      if (score < configDraft.ui.repeatOffenderMinScore) continue;

      rows.push({
        email,
        score,
        attempts24h,
        blocked24h,
        events24h,
        ips24h,
        noShow180d,
        noShowEvents180d,
        last24hAt: a?.lastAt || '',
        lastNoShowAt: n?.lastAt || '',
      });
    }

    rows.sort((x, y) => y.score - x.score || y.noShow180d - x.noShow180d || y.blocked24h - x.blocked24h || y.attempts24h - x.attempts24h);
    return rows.slice(0, 30);
  }, [activityByEmail, configDraft.ui.repeatOffenderMinScore, noShowByEmail]);

  const downloadRepeatOffendersCsv = useCallback(() => {
    const rows = repeatOffenders.map((r) => ({
      email: r.email,
      score: String(r.score),
      attempts_24h: String(r.attempts24h),
      blocked_24h: String(r.blocked24h),
      events_24h: String(r.events24h),
      ips_24h: String(r.ips24h),
      no_show_180d: String(r.noShow180d),
      no_show_events_180d: String(r.noShowEvents180d),
      last_24h_at: String(r.last24hAt || ''),
      last_no_show_at: String(r.lastNoShowAt || ''),
    }));
    const header = Object.keys(rows[0] || { email: '' });
    const esc = (v: any) => `"${String(v ?? '').replaceAll('"', '""')}"`;
    const csv = [header.join(','), ...rows.map((row: any) => header.map((h) => esc(row[h])).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `repeat_offenders_${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [repeatOffenders]);

  const downloadNoShowCsv = useCallback(() => {
    const rows = noShowStats.top.map((r) => ({
      email: r.email,
      no_show_count: String(r.count),
      distinct_events: String(r.events.size),
      last_at: String(r.lastAt || ''),
    }));
    const header = Object.keys(rows[0] || { email: '' });
    const esc = (v: any) => `"${String(v ?? '').replaceAll('"', '""')}"`;
    const csv = [header.join(','), ...rows.map((r: any) => header.map((h) => esc(r[h])).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `no_show_top_180d_${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [noShowStats.top]);

  const downloadIncidentCsv = useCallback(() => {
    const rows = (activity || []).map((row: any) => {
      const d = row.details || {};
      return {
        created_at: String(row.created_at || ''),
        action: String(row.action || ''),
        event_id: String(d.eventId || row.target_id || ''),
        email: String((d.email || row.admin_email || '')).toLowerCase(),
        ip: String(d.ip || ''),
        ua: String(d.ua || ''),
        user_id: String(d.userId || ''),
        attendees_count: d.attendeesCount != null ? String(d.attendeesCount) : '',
        payment_method: String(d.paymentMethod || ''),
        promo_code: String(d.promoCode || ''),
        reason: String(d.reason || ''),
      };
    });

    const header = Object.keys(rows[0] || { created_at: '' });
    const esc = (v: any) => `"${String(v ?? '').replaceAll('"', '""')}"`;
    const csv = [header.join(','), ...rows.map((r: any) => header.map((h) => esc(r[h])).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `ticket_incident_24h_${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activity]);

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch('/api/admin/tickets/blacklist/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ entries: normalized }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Save failed');
      showToast('Uloženo', 'success');
      await load();
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setSaving(false);
    }
  };

  const add = () => {
    const v = normalizeEntryValue(newValue);
    if (!v) return;
    addEntry(v, newNote.trim() || '');
    setNewValue('');
    setNewNote('');
  };

  const saveConfig = async () => {
    setSavingConfig(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch('/api/admin/tickets/security-config/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ config: configDraft }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Save failed');
      showToast('Uloženo', 'success');
      await loadConfig();
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-xl font-bold mb-2 flex items-center gap-3">
              <Shield className="text-green-600" />
              {dict?.admin?.tabTicketSecurity || 'Anti-fraud'}
            </h2>
            <p className="text-stone-500 font-medium">Blacklist e-mailů a domén pro registrace.</p>
            {updatedAt && (
              <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-stone-300">
                Aktualizováno: {new Date(updatedAt).toLocaleString('cs-CZ')}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-green-200 bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50"
          >
            {saving ? <InlinePulse className="bg-white/80" size={12} /> : <Save size={16} />}
            Uložit
          </button>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">Limity</div>
            <div className="text-stone-500 font-medium mt-2">Konfigurace bez deploye (RLS-safe).</div>
            {configUpdatedAt && (
              <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-stone-300">
                Aktualizováno: {new Date(configUpdatedAt).toLocaleString('cs-CZ')}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={saveConfig}
            disabled={savingConfig}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-green-200 bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50"
          >
            {savingConfig ? <InlinePulse className="bg-white/80" size={12} /> : <Save size={16} />}
            Uložit limity
          </button>
        </div>

        <div className="grid md:grid-cols-12 gap-4">
          <div className="md:col-span-4 bg-stone-50 border border-stone-100 rounded-[2rem] p-6">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4">RSVP rate-limit</div>
            <div className="space-y-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Okno (min)</div>
                <input
                  value={String(configDraft.rsvp.windowMinutes)}
                  onChange={(e) => setConfigDraft((p) => ({ ...p, rsvp: { ...p.rsvp, windowMinutes: Number(e.target.value || 0) } }))}
                  className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition"
                  inputMode="numeric"
                />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Max / IP</div>
                <input
                  value={String(configDraft.rsvp.maxAttemptsPerIp)}
                  onChange={(e) => setConfigDraft((p) => ({ ...p, rsvp: { ...p.rsvp, maxAttemptsPerIp: Number(e.target.value || 0) } }))}
                  className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition"
                  inputMode="numeric"
                />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Max / e-mail</div>
                <input
                  value={String(configDraft.rsvp.maxAttemptsPerEmail)}
                  onChange={(e) => setConfigDraft((p) => ({ ...p, rsvp: { ...p.rsvp, maxAttemptsPerEmail: Number(e.target.value || 0) } }))}
                  className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition"
                  inputMode="numeric"
                />
              </div>
            </div>
          </div>

          <div className="md:col-span-4 bg-stone-50 border border-stone-100 rounded-[2rem] p-6">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4">Doporučení domén</div>
            <div className="space-y-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Min. attempts (24h)</div>
                <input
                  value={String(configDraft.domainSuggest.minAttempts)}
                  onChange={(e) => setConfigDraft((p) => ({ ...p, domainSuggest: { ...p.domainSuggest, minAttempts: Number(e.target.value || 0) } }))}
                  className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition"
                  inputMode="numeric"
                />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Min. distinct e-maily (24h)</div>
                <input
                  value={String(configDraft.domainSuggest.minDistinctEmails)}
                  onChange={(e) => setConfigDraft((p) => ({ ...p, domainSuggest: { ...p.domainSuggest, minDistinctEmails: Number(e.target.value || 0) } }))}
                  className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition"
                  inputMode="numeric"
                />
              </div>
            </div>
          </div>

          <div className="md:col-span-4 bg-stone-50 border border-stone-100 rounded-[2rem] p-6">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4">UI prahy</div>
            <div className="space-y-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">IP med attempts</div>
                <input
                  value={String(configDraft.ui.ipMedAttempts)}
                  onChange={(e) => setConfigDraft((p) => ({ ...p, ui: { ...p.ui, ipMedAttempts: Number(e.target.value || 0) } }))}
                  className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition"
                  inputMode="numeric"
                />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">IP high attempts</div>
                <input
                  value={String(configDraft.ui.ipHighAttempts)}
                  onChange={(e) => setConfigDraft((p) => ({ ...p, ui: { ...p.ui, ipHighAttempts: Number(e.target.value || 0) } }))}
                  className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition"
                  inputMode="numeric"
                />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">IP high distinct e-maily</div>
                <input
                  value={String(configDraft.ui.ipHighDistinctEmails)}
                  onChange={(e) => setConfigDraft((p) => ({ ...p, ui: { ...p.ui, ipHighDistinctEmails: Number(e.target.value || 0) } }))}
                  className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition"
                  inputMode="numeric"
                />
              </div>
              <div className="pt-2">
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Repeat offenders min score</div>
                <input
                  value={String(configDraft.ui.repeatOffenderMinScore)}
                  onChange={(e) => setConfigDraft((p) => ({ ...p, ui: { ...p.ui, repeatOffenderMinScore: Number(e.target.value || 0) } }))}
                  className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition"
                  inputMode="numeric"
                />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Repeat offenders med score</div>
                <input
                  value={String(configDraft.ui.repeatOffenderMedScore)}
                  onChange={(e) => setConfigDraft((p) => ({ ...p, ui: { ...p.ui, repeatOffenderMedScore: Number(e.target.value || 0) } }))}
                  className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition"
                  inputMode="numeric"
                />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Repeat offenders high score</div>
                <input
                  value={String(configDraft.ui.repeatOffenderHighScore)}
                  onChange={(e) => setConfigDraft((p) => ({ ...p, ui: { ...p.ui, repeatOffenderHighScore: Number(e.target.value || 0) } }))}
                  className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition"
                  inputMode="numeric"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">No-show (180 dní)</div>
            <div className="text-stone-500 font-medium mt-2">Top e-maily podle počtu no-show.</div>
          </div>
          <button
            type="button"
            onClick={downloadNoShowCsv}
            disabled={noShowStats.top.length === 0}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition disabled:opacity-50"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>

        {noShowLoading ? (
          <div className="py-10 flex items-center justify-center">
            <InlinePulse className="bg-stone-200" size={18} />
          </div>
        ) : noShowStats.top.length === 0 ? (
          <div className="py-10 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">—</div>
        ) : (
          <div className="space-y-3">
            {noShowStats.top.map((r) => {
              const at = r.email.lastIndexOf('@');
              const domain = at >= 0 ? r.email.slice(at + 1) : '';
              return (
                <div key={r.email} className="bg-stone-50 border border-stone-100 rounded-[2rem] p-6 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-black text-stone-900 truncate">{r.email}</div>
                    <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-stone-300">
                      no-show {r.count} • events {r.events.size}
                      {r.lastAt ? ` • last ${new Date(r.lastAt).toLocaleDateString('cs-CZ')}` : ''}
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => addEntry(r.email, 'auto: no-show history')}
                      className="rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
                    >
                      Blacklist email
                    </button>
                    {domain && (
                      <button
                        type="button"
                        onClick={() => addEntry(domain, 'auto: no-show domain')}
                        className="rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
                      >
                        Blacklist doména
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">Repeat offenders</div>
            <div className="text-stone-500 font-medium mt-2">Heuristika: no-show (180 dní) + aktivita (24h).</div>
          </div>
          <button
            type="button"
            onClick={downloadRepeatOffendersCsv}
            disabled={repeatOffenders.length === 0}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition disabled:opacity-50"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>

        {noShowLoading || activityLoading ? (
          <div className="py-10 flex items-center justify-center">
            <InlinePulse className="bg-stone-200" size={18} />
          </div>
        ) : repeatOffenders.length === 0 ? (
          <div className="py-10 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">—</div>
        ) : (
          <div className="space-y-3">
            {repeatOffenders.map((r) => {
              const at = r.email.lastIndexOf('@');
              const domain = at >= 0 ? r.email.slice(at + 1) : '';
              const risk =
                r.score >= configDraft.ui.repeatOffenderHighScore ? 'high' : r.score >= configDraft.ui.repeatOffenderMedScore ? 'med' : 'low';
              return (
                <div key={r.email} className="bg-stone-50 border border-stone-100 rounded-[2rem] p-6 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="font-black text-stone-900 truncate">{r.email}</div>
                      <span
                        className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          risk === 'high' ? 'bg-red-100 text-red-700' : risk === 'med' ? 'bg-amber-100 text-amber-700' : 'bg-stone-200 text-stone-700'
                        }`}
                      >
                        score {r.score}
                      </span>
                    </div>
                    <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-stone-300">
                      24h: attempts {r.attempts24h} • blocked {r.blocked24h} • events {r.events24h} • ips {r.ips24h}
                    </div>
                    <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-stone-300">
                      180d: no-show {r.noShow180d} • events {r.noShowEvents180d}
                      {r.last24hAt ? ` • last24h ${new Date(r.last24hAt).toLocaleString('cs-CZ')}` : ''}
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => addEntry(r.email, 'auto: repeat offender')}
                      className="rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
                    >
                      Blacklist email
                    </button>
                    {domain && (
                      <button
                        type="button"
                        onClick={() => addEntry(domain, 'auto: repeat offender domain')}
                        className="rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
                      >
                        Blacklist doména
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">Aktivita (24h)</div>
            <div className="text-stone-500 font-medium mt-2">Přehled pokusů o registraci a blokací.</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={downloadIncidentCsv}
              disabled={!activity || activity.length === 0}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition disabled:opacity-50"
            >
              <Download size={14} />
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => refetchActivity()}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
            >
              Obnovit
            </button>
          </div>
        </div>

        {activityLoading ? (
          <div className="py-10 flex items-center justify-center">
            <InlinePulse className="bg-stone-200" size={18} />
          </div>
        ) : (
          <div className="grid lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 bg-stone-50 border border-stone-100 rounded-[2rem] p-6">
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4">Top IP adresy</div>
              {activityStats.topIps.length === 0 ? (
                <div className="text-xs font-bold text-stone-400 uppercase tracking-widest">—</div>
              ) : (
                <div className="space-y-3">
                  {activityStats.topIps.map((r) => {
                    const risk =
                      r.attempts >= configDraft.ui.ipHighAttempts || r.emails.size >= configDraft.ui.ipHighDistinctEmails
                        ? 'high'
                        : r.attempts >= configDraft.ui.ipMedAttempts
                          ? 'med'
                          : 'low';
                    return (
                      <div key={r.ip} className="bg-white border border-stone-200 rounded-2xl p-4 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="font-black text-stone-900">{r.ip}</div>
                          <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-stone-300">
                            attempts {r.attempts} • blocked {r.blocked} • emails {r.emails.size}
                          </div>
                          {r.lastAt && (
                            <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-stone-300">
                              last {new Date(r.lastAt).toLocaleString('cs-CZ')}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          <span
                            className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                              risk === 'high' ? 'bg-red-100 text-red-700' : risk === 'med' ? 'bg-amber-100 text-amber-700' : 'bg-stone-200 text-stone-700'
                            }`}
                          >
                            {risk}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="lg:col-span-6 bg-stone-50 border border-stone-100 rounded-[2rem] p-6">
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4">Top e-maily</div>
              {activityStats.topEmails.length === 0 ? (
                <div className="text-xs font-bold text-stone-400 uppercase tracking-widest">—</div>
              ) : (
                <div className="space-y-3">
                  {activityStats.topEmails.map((r) => {
                    const at = r.email.lastIndexOf('@');
                    const domain = at >= 0 ? r.email.slice(at + 1) : '';
                    return (
                      <div key={r.email} className="bg-white border border-stone-200 rounded-2xl p-4 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="font-black text-stone-900 truncate">{r.email}</div>
                          <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-stone-300">
                            attempts {r.attempts} • blocked {r.blocked} • events {r.events.size} • ips {r.ips.size}
                          </div>
                          {r.lastAt && (
                            <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-stone-300">
                              last {new Date(r.lastAt).toLocaleString('cs-CZ')}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => addEntry(r.email, 'auto: suspicious activity')}
                            className="rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
                          >
                            Blacklist email
                          </button>
                          {domain && (
                            <button
                              type="button"
                              onClick={() => addEntry(domain, 'auto: suspicious domain')}
                              className="rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
                            >
                              Blacklist doména
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="lg:col-span-12 bg-stone-50 border border-stone-100 rounded-[2rem] p-6">
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4">Doporučené domény</div>
              {domainSuggestions.length === 0 ? (
                <div className="text-xs font-bold text-stone-400 uppercase tracking-widest">—</div>
              ) : (
                <div className="space-y-2">
                  {domainSuggestions.map((d) => (
                    <div key={d.domain} className="bg-white border border-stone-200 rounded-2xl p-4 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="font-black text-stone-900">{d.domain}</div>
                        <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-stone-300">
                          attempts {d.attempts} • blocked {d.blocked} • emails {d.emails.size} • ips {d.ips.size}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => addEntry(d.domain, 'auto: domain suggestion')}
                        className="shrink-0 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
                      >
                        Blacklist doména
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-12 bg-stone-50 border border-stone-100 rounded-[2rem] p-6">
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4">Poslední blokace</div>
              {activityStats.recentBlocked.length === 0 ? (
                <div className="text-xs font-bold text-stone-400 uppercase tracking-widest">—</div>
              ) : (
                <div className="space-y-2">
                  {activityStats.recentBlocked.map((row: any) => {
                    const d = row.details || {};
                    const email = d.email ? String(d.email) : row.admin_email ? String(row.admin_email) : '';
                    const ip = d.ip ? String(d.ip) : '';
                    const eventId = row.target_id ? String(row.target_id) : '';
                    return (
                      <div key={row.id} className="bg-white border border-stone-200 rounded-2xl p-4 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="font-black text-stone-900 truncate">{email || '—'}</div>
                          <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-stone-300">
                            {ip ? `ip ${ip}` : 'ip —'} • {eventId ? `event ${eventId}` : 'event —'} •{' '}
                            {row.created_at ? new Date(row.created_at).toLocaleString('cs-CZ') : '—'}
                          </div>
                        </div>
                        {email && (
                          <button
                            type="button"
                            onClick={() => addEntry(email, 'auto: blocked')}
                            className="shrink-0 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
                          >
                            Blacklist email
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
        <div className="grid md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-5">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">E-mail nebo doména</div>
            <input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="w-full bg-stone-50 border-none rounded-2xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none"
              placeholder="např. spammer@example.com nebo example.com"
            />
          </div>
          <div className="md:col-span-5">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Poznámka</div>
            <input
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="w-full bg-stone-50 border-none rounded-2xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none"
              placeholder="důvod / zdroj"
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="button"
              onClick={add}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-4 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
            >
              <Plus size={16} />
              Přidat
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] border shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <InlinePulse className="bg-stone-200" size={18} />
          </div>
        ) : normalized.length === 0 ? (
          <div className="py-16 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">
            Blacklist je prázdný.
          </div>
        ) : (
          <div className="space-y-3">
            {normalized.slice(0, 500).map((e) => (
              <div key={e.value} className="p-5 bg-stone-50 rounded-[2rem] border border-stone-100 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-black text-stone-900">{e.value}</div>
                  {e.note && <div className="mt-1 text-sm font-medium text-stone-600">{e.note}</div>}
                </div>
                <button
                  type="button"
                  onClick={() => setEntries((prev) => (prev || []).filter((x) => normalizeEntryValue(x.value) !== e.value))}
                  className="shrink-0 inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
                >
                  <Trash2 size={16} />
                  Odebrat
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
