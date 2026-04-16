'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ShieldCheck, Save, Trash2, UserPlus } from 'lucide-react';
import { useToast } from '@/app/context/ToastContext';
import InlinePulse from '@/app/components/InlinePulse';
import AdminModuleHeader from './ui/AdminModuleHeader';
import AdminPanel from './ui/AdminPanel';
import Popover from '@/app/components/ui/Popover';

type Role = { id: string; name: string; permissions: any; color_hex?: string };
type Assignment = { user_id: string; role_id: string; assigned_at: string; assigned_by_email?: string | null; profiles?: any };

export default function RolesTab({ dict }: { dict: any }) {
  const t = dict?.adminRoles || {};
  const errorMsg = String(t?.error || 'Chyba');
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [permissionKeys, setPermissionKeys] = useState<string[]>([]);

  const [editing, setEditing] = useState<Role | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleColorHex, setRoleColorHex] = useState('#16a34a');
  const [rolePerms, setRolePerms] = useState<any>({});

  const [assignQuery, setAssignQuery] = useState('');
  const [assignSelectedUser, setAssignSelectedUser] = useState<any>(null);
  const [assignResults, setAssignResults] = useState<any[]>([]);
  const [assignSearching, setAssignSearching] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignRoleId, setAssignRoleId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const assignAnchorRef = useRef<HTMLDivElement>(null);

  const assignmentsGrouped = useMemo(() => {
    const out: Array<{ userId: string; profile: any; items: Assignment[] }> = [];
    const byUser = new Map<string, { userId: string; profile: any; items: Assignment[] }>();
    for (const a of assignments) {
      const userId = String(a.user_id || '').trim();
      if (!userId) continue;
      const prev = byUser.get(userId);
      if (prev) {
        prev.items.push(a);
      } else {
        byUser.set(userId, { userId, profile: a.profiles || null, items: [a] });
      }
    }
    for (const v of byUser.values()) out.push(v);
    out.sort((a, b) => {
      const at = a.items[0]?.assigned_at ? new Date(a.items[0].assigned_at).getTime() : 0;
      const bt = b.items[0]?.assigned_at ? new Date(b.items[0].assigned_at).getTime() : 0;
      return bt - at;
    });
    return out;
  }, [assignments]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch('/api/admin/roles', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Error');
      setRoles(Array.isArray(json?.roles) ? json.roles : []);
      setAssignments(Array.isArray(json?.assignments) ? json.assignments : []);
      setPermissionKeys(Array.isArray(json?.permissionKeys) ? json.permissionKeys : []);
    } catch (e: any) {
      showToast(e?.message || errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  }, [errorMsg, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const groupedKeys = useMemo(() => {
    const groups: Record<string, string[]> = { [String(t.groupBase || 'Základ')]: [], [String(t.groupModules || 'Moduly')]: [] };
    for (const k of permissionKeys) {
      const baseKey = String(t.groupBase || 'Základ');
      const modulesKey = String(t.groupModules || 'Moduly');
      if (k === 'is_admin' || k === 'is_member' || k === 'can_manage_admins') groups[baseKey].push(k);
      else groups[modulesKey].push(k);
    }
    return groups;
  }, [permissionKeys, t.groupBase, t.groupModules]);

  const startCreate = () => {
    setEditing(null);
    setRoleName('');
    setRoleColorHex('#16a34a');
    setRolePerms({});
  };

  const startEdit = (r: Role) => {
    setEditing(r);
    setRoleName(r.name || '');
    setRoleColorHex(String(r.color_hex || '#16a34a'));
    setRolePerms(r.permissions && typeof r.permissions === 'object' ? r.permissions : {});
  };

  const textColorForBg = (hex: string) => {
    const h = String(hex || '').trim();
    const m = h.match(/^#([0-9a-f]{6})$/i);
    if (!m) return '#ffffff';
    const v = m[1];
    const r = parseInt(v.slice(0, 2), 16);
    const g = parseInt(v.slice(2, 4), 16);
    const b = parseInt(v.slice(4, 6), 16);
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return lum > 0.6 ? '#111827' : '#ffffff';
  };

  const saveRole = async () => {
    setSaving(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: editing?.id || null, name: roleName, color_hex: roleColorHex, permissions: rolePerms }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Error');
      showToast(String(t.saved || 'Uloženo'), 'success');
      await load();
      setEditing(null);
      setRoleName('');
      setRoleColorHex('#16a34a');
      setRolePerms({});
    } catch (e: any) {
      showToast(e?.message || (t?.error || 'Chyba'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async (id: string) => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch(`/api/admin/roles/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Error');
      showToast(String(t.deleted || 'Smazáno'), 'success');
      await load();
    } catch (e: any) {
      showToast(e?.message || (t?.error || 'Chyba'), 'error');
    }
  };

  const updateAssignment = async ({
    userId,
    email,
    roleId,
    action,
  }: {
    userId?: string | null;
    email?: string | null;
    roleId?: string | null;
    action?: string;
  }) => {
    setAssigning(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch('/api/admin/roles/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: userId || null, email: email || null, roleId: roleId || null, action: action || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Error');
      showToast(String(t.saved || 'Uloženo'), 'success');
      if ((action || '').toLowerCase() !== 'unassign') {
        setAssignQuery('');
        setAssignSelectedUser(null);
        setAssignResults([]);
        setAssignOpen(false);
        setAssignRoleId('');
      }
      await load();
    } catch (e: any) {
      showToast(e?.message || (t?.error || 'Chyba'), 'error');
    } finally {
      setAssigning(false);
    }
  };

  useEffect(() => {
    const q = String(assignQuery || '').trim();
    if (assignSelectedUser) return;
    if (q.length < 2) {
      setAssignResults([]);
      setAssignSearching(false);
      return;
    }
    let cancelled = false;
    setAssignSearching(true);
    const tmr = setTimeout(async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error('Unauthorized');
        const res = await fetch(`/api/admin/users/search?query=${encodeURIComponent(q)}&limit=10`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'Error');
        if (cancelled) return;
        setAssignResults(Array.isArray(json?.users) ? json.users : []);
      } catch {
        if (cancelled) return;
        setAssignResults([]);
      } finally {
        if (cancelled) return;
        setAssignSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(tmr);
    };
  }, [assignQuery, assignSelectedUser]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <AdminModuleHeader
        title={t.title || dict.admin?.tabRoles || 'Role'}
        description={t.description || 'Pojmenované role s oprávněními a přiřazení uživatelům.'}
        actions={
          <div className="flex items-center gap-2 px-4 py-2 bg-stone-50 rounded-xl border border-stone-100">
            <ShieldCheck size={16} className="text-green-600" />
            <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">{t.superAdminBadge || 'SuperAdmin'}</span>
          </div>
        }
      />

      {loading ? (
        <div className="bg-white rounded-[2.5rem] border shadow-sm p-10 flex items-center justify-center">
          <InlinePulse className="bg-stone-200" size={18} />
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <AdminPanel className="p-8 space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="text-lg font-black text-stone-900">{t.title || dict.admin?.tabRoles || 'Role'}</div>
              <button
                type="button"
                onClick={startCreate}
                className="px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition bg-white text-stone-700 border-stone-200 hover:bg-stone-50"
              >
                {t.addRole || dict.admin?.btnAdd || 'Přidat'}
              </button>
            </div>

            <div className="grid gap-3">
              {roles.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 bg-stone-50 border border-stone-100 rounded-[2rem] px-6 py-5">
                  <div className="min-w-0">
                    <div className="font-black text-stone-900 truncate flex items-center gap-2">
                      <span
                        className="inline-flex h-3 w-3 rounded-full border"
                        style={{ backgroundColor: String(r.color_hex || '#64748b'), borderColor: String(r.color_hex || '#64748b') }}
                      />
                      <span className="truncate">{r.name}</span>
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mt-1">
                      {(() => {
                        const count = Object.keys(r.permissions || {}).filter((k) => (r.permissions || {})[k]).length;
                        const tpl = String(t.permissionsCount || '{count} oprávnění');
                        return tpl.replace('{count}', String(count));
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => startEdit(r)}
                      className="px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition bg-white text-stone-700 border-stone-200 hover:bg-stone-50"
                    >
                      {t.editRole || dict.admin?.btnEdit || 'Upravit'}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteRole(r.id)}
                      className="px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {roles.length === 0 && (
                <div className="py-10 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">
                  {t.emptyRoles || dict.admin?.empty || 'Žádné role'}
                </div>
              )}
            </div>
          </AdminPanel>

          <AdminPanel className="p-8 space-y-6">
            <div className="text-lg font-black text-stone-900">{editing ? (t.editRole || dict.admin?.btnEdit || 'Upravit') : (t.addRole || dict.admin?.btnAdd || 'Přidat')}</div>
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{t.nameLabel || dict.admin?.labelName || 'Název'}</div>
              <input
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
              />
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{t.colorLabel || 'Barva role'}</div>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={roleColorHex}
                  onChange={(e) => setRoleColorHex(e.target.value)}
                  className="h-12 w-12 rounded-xl border border-stone-200 bg-white"
                  aria-label={t.colorLabel || 'Barva role'}
                />
                <input
                  value={roleColorHex}
                  onChange={(e) => setRoleColorHex(e.target.value)}
                  className="flex-1 bg-stone-50 border-none rounded-2xl px-5 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                  placeholder="#16a34a"
                />
                <span
                  className="px-3 py-2 rounded-full text-[9px] font-black uppercase tracking-widest border"
                  style={{ backgroundColor: roleColorHex, borderColor: roleColorHex, color: textColorForBg(roleColorHex) }}
                >
                  {roleName?.trim() ? roleName.trim() : 'Role'}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              {Object.entries(groupedKeys).map(([group, keys]) => (
                <div key={group} className="space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{group}</div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {keys.map((k) => {
                      const on = !!rolePerms?.[k];
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setRolePerms((p: any) => ({ ...(p || {}), [k]: !on }))}
                          className={`px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                            on ? 'bg-green-600 text-white border-green-600 shadow-lg' : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'
                          }`}
                        >
                          {k.replaceAll('_', ' ')}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={saveRole}
              disabled={saving || !roleName.trim()}
              className="w-full bg-green-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-green-700 transition shadow-lg shadow-green-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? <InlinePulse className="bg-white/80" size={14} /> : <Save size={16} />} {t.save || dict.admin?.btnSave || 'Uložit'}
            </button>
          </AdminPanel>

          <AdminPanel className="p-8 space-y-6 lg:col-span-2">
            <div className="flex items-center justify-between gap-4">
              <div className="text-lg font-black text-stone-900">{t.assignmentsTitle || dict.admin?.tabRoleAssign || 'Přiřazení'}</div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{t.assignUserLabel || 'Uživatel'}</div>
                <div className="relative" ref={assignAnchorRef}>
                  <input
                    value={assignSelectedUser ? `${String(assignSelectedUser.first_name || '').trim()} ${String(assignSelectedUser.last_name || '').trim()}`.trim() : assignQuery}
                    onChange={(e) => {
                      setAssignSelectedUser(null);
                      setAssignQuery(e.target.value);
                      setAssignOpen(true);
                    }}
                    onFocus={() => setAssignOpen(true)}
                    onBlur={() => setTimeout(() => setAssignOpen(false), 120)}
                    placeholder={t.assignUserPlaceholder || 'Začněte psát jméno…'}
                    className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                  />
                  {assignOpen && !assignSelectedUser ? (
                    <Popover
                      open={assignOpen && !assignSelectedUser}
                      onClose={() => setAssignOpen(false)}
                      anchorRef={assignAnchorRef}
                      placement="bottom-start"
                      offset={8}
                      matchWidth
                      zIndex={200}
                      panelClassName="bg-white border border-stone-200 rounded-2xl shadow-xl overflow-hidden"
                    >
                      {assignSearching ? (
                        <div className="p-4 text-stone-400 font-bold text-sm">Načítám…</div>
                      ) : assignResults.length ? (
                        <div className="max-h-72 overflow-auto">
                          {assignResults.map((u: any) => {
                            const first = String(u.first_name || '').trim();
                            const last = String(u.last_name || '').trim();
                            const full = `${first} ${last}`.trim() || String(u.email || '').trim();
                            const emailValue = String(u.email || '').trim();
                            return (
                              <button
                                key={String(u.id)}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setAssignSelectedUser(u);
                                  setAssignQuery('');
                                  setAssignResults([]);
                                  setAssignOpen(false);
                                }}
                                className="w-full text-left px-5 py-4 hover:bg-stone-50 transition"
                              >
                                <div className="font-black text-stone-900">{full}</div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mt-1">
                                  {emailValue}
                                  {u.is_member ? ' • člen' : ''}
                                  {u.is_admin ? ' • admin' : ''}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-4 text-stone-400 font-bold text-sm">{t.noResults || 'Nic nenalezeno.'}</div>
                      )}
                    </Popover>
                  ) : null}
                </div>
                {assignSelectedUser?.email ? (
                  <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{String(assignSelectedUser.email)}</div>
                ) : null}
              </div>
              <div className="md:col-span-1">
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{t.assignRoleLabel || 'Role'}</div>
                <select
                  value={assignRoleId}
                  onChange={(e) => setAssignRoleId(e.target.value)}
                  className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                >
                  <option value="">—</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-1 flex items-end gap-3">
                <button
                  type="button"
                  disabled={assigning || !assignSelectedUser?.id || !assignRoleId}
                  onClick={() =>
                    updateAssignment({
                      userId: String(assignSelectedUser.id),
                      email: assignSelectedUser?.email ? String(assignSelectedUser.email) : null,
                      roleId: assignRoleId,
                      action: 'assign',
                    })
                  }
                  className="w-full bg-stone-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-green-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {assigning ? <InlinePulse className="bg-white/80" size={14} /> : <UserPlus size={16} />} {t.assign || 'Přiřadit'}
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              {assignmentsGrouped.map((g) => (
                <div key={g.userId} className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-stone-50 border border-stone-100 rounded-[2rem] px-6 py-5">
                  <div className="min-w-0">
                    <div className="font-black text-stone-900 truncate">
                      {g.profile?.first_name || ''} {g.profile?.last_name || ''}{' '}
                      <span className="text-stone-400 font-bold">{g.profile?.email ? `(${g.profile.email})` : ''}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {g.items.map((a) => {
                        const role = roles.find((r) => r.id === a.role_id);
                        const colorHex = String(role?.color_hex || '#64748b');
                        const label = String(role?.name || a.role_id || '').trim();
                        return (
                          <span
                            key={`${g.userId}_${a.role_id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border"
                            style={{ backgroundColor: colorHex, borderColor: colorHex, color: textColorForBg(colorHex) }}
                          >
                            {label}
                            {g.profile?.email ? (
                              <button
                                type="button"
                                disabled={assigning}
                                onClick={() =>
                                  updateAssignment({ userId: String(g.userId), email: String(g.profile.email), roleId: String(a.role_id), action: 'unassign' })
                                }
                                className="ml-1 inline-flex items-center justify-center h-5 w-5 rounded-full bg-white/20 hover:bg-white/30 transition disabled:opacity-50"
                                aria-label={t.unassign || 'Odebrat'}
                              >
                                <Trash2 size={12} />
                              </button>
                            ) : null}
                          </span>
                        );
                      })}
                      {g.items.some((a) => a.assigned_by_email) ? (
                        <span className="text-[10px] font-bold text-stone-400 truncate">
                          {String(g.items.find((a) => a.assigned_by_email)?.assigned_by_email || '')}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {g.profile?.email ? (
                    <button
                      type="button"
                      disabled={assigning}
                      onClick={() => updateAssignment({ userId: String(g.userId), email: String(g.profile.email), roleId: null, action: 'clear' })}
                      className="shrink-0 px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition bg-white text-stone-700 border-stone-200 hover:bg-stone-50 disabled:opacity-50"
                    >
                      {t.unassign || 'Odebrat'} vše
                    </button>
                  ) : null}
                </div>
              ))}
              {assignmentsGrouped.length === 0 && (
                <div className="py-10 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">
                  {t.emptyAssignments || 'Žádná přiřazení'}
                </div>
              )}
            </div>
          </AdminPanel>
        </div>
      )}
    </div>
  );
}
