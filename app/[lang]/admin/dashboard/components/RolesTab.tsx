'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ShieldCheck, Save, Trash2, UserPlus } from 'lucide-react';
import { useToast } from '@/app/context/ToastContext';
import InlinePulse from '@/app/components/InlinePulse';
import AdminModuleHeader from './ui/AdminModuleHeader';
import AdminPanel from './ui/AdminPanel';

type Role = { id: string; name: string; permissions: any };
type Assignment = { user_id: string; role_id: string; assigned_at: string; assigned_by_email?: string | null; profiles?: any };

export default function RolesTab({ dict }: { dict: any }) {
  const t = dict?.adminRoles || {};
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [permissionKeys, setPermissionKeys] = useState<string[]>([]);

  const [editing, setEditing] = useState<Role | null>(null);
  const [roleName, setRoleName] = useState('');
  const [rolePerms, setRolePerms] = useState<any>({});

  const [assignEmail, setAssignEmail] = useState('');
  const [assignRoleId, setAssignRoleId] = useState('');
  const [assigning, setAssigning] = useState(false);

  const load = async () => {
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
      showToast(e?.message || (t?.error || 'Chyba'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const groupedKeys = useMemo(() => {
    const groups: Record<string, string[]> = { [String(t.groupBase || 'Základ')]: [], [String(t.groupModules || 'Moduly')]: [] };
    for (const k of permissionKeys) {
      const baseKey = String(t.groupBase || 'Základ');
      const modulesKey = String(t.groupModules || 'Moduly');
      if (k === 'is_admin' || k === 'is_member' || k === 'can_manage_admins') groups[baseKey].push(k);
      else groups[modulesKey].push(k);
    }
    return groups;
  }, [permissionKeys]);

  const startCreate = () => {
    setEditing(null);
    setRoleName('');
    setRolePerms({});
  };

  const startEdit = (r: Role) => {
    setEditing(r);
    setRoleName(r.name || '');
    setRolePerms(r.permissions && typeof r.permissions === 'object' ? r.permissions : {});
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
        body: JSON.stringify({ id: editing?.id || null, name: roleName, permissions: rolePerms }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Error');
      showToast(String(t.saved || 'Uloženo'), 'success');
      await load();
      setEditing(null);
      setRoleName('');
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

  const assign = async (roleId: string | null) => {
    setAssigning(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch('/api/admin/roles/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: assignEmail, roleId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Error');
      showToast(String(t.saved || 'Uloženo'), 'success');
      setAssignEmail('');
      setAssignRoleId('');
      await load();
    } catch (e: any) {
      showToast(e?.message || (t?.error || 'Chyba'), 'error');
    } finally {
      setAssigning(false);
    }
  };

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
                    <div className="font-black text-stone-900 truncate">{r.name}</div>
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
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{t.assignEmailLabel || 'E-mail uživatele'}</div>
                <input
                  value={assignEmail}
                  onChange={(e) => setAssignEmail(e.target.value)}
                  className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                />
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
                  disabled={assigning || !assignEmail.trim() || !assignRoleId}
                  onClick={() => assign(assignRoleId)}
                  className="w-full bg-stone-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-green-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {assigning ? <InlinePulse className="bg-white/80" size={14} /> : <UserPlus size={16} />} {t.assign || 'Přiřadit'}
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              {assignments.map((a) => (
                <div key={a.user_id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-stone-50 border border-stone-100 rounded-[2rem] px-6 py-5">
                  <div className="min-w-0">
                    <div className="font-black text-stone-900 truncate">
                      {a.profiles?.first_name || ''} {a.profiles?.last_name || ''}{' '}
                      <span className="text-stone-400 font-bold">{a.profiles?.email ? `(${a.profiles.email})` : ''}</span>
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mt-1">
                      {roles.find((r) => r.id === a.role_id)?.name || a.role_id}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={assigning}
                    onClick={async () => {
                      setAssignEmail(String(a.profiles?.email || ''));
                      await assign(null);
                    }}
                    className="shrink-0 px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition bg-white text-stone-700 border-stone-200 hover:bg-stone-50 disabled:opacity-50"
                  >
                    {t.unassign || 'Odebrat'}
                  </button>
                </div>
              ))}
              {assignments.length === 0 && (
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
