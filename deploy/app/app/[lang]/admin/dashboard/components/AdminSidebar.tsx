'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  ShieldCheck,
  LogOut,
  ChevronRight,
  Menu,
  X,
  ChevronDown
} from 'lucide-react';
import { buildAdminMenuGroups } from './adminMenu';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import Drawer from '@/app/components/ui/Drawer';

interface AdminSidebarProps {
  lang: string;
  dict: any;
  activeTab: string;
  onTabChange: (tab: string) => void;
  userProfile: any;
  permissions: any;
  onLogout: () => void;
}

interface SidebarContentProps {
  lang: string;
  dict: any;
  activeTab: string;
  onTabChange: (tab: string) => void;
  userProfile: any;
  permissions: any;
  onLogout: () => void;
  setIsMobileOpen: (val: boolean) => void;
}

const SidebarContent = ({ 
  lang, dict, activeTab, onTabChange, userProfile, permissions, onLogout, setIsMobileOpen 
}: SidebarContentProps) => {
  const menuGroups = buildAdminMenuGroups(dict, permissions);
  const appsVisible = menuGroups.some((g) => g.items.some((it) => it.id === 'apps' && it.visible));
  const pendingAppsQuery = useQuery({
    queryKey: ['applications_pending_count'],
    enabled: appsVisible,
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return 0;
      const res = await fetch('/api/admin/applications?pendingCount=1', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Chyba');
      return Number(json?.count || 0);
    },
  });
  const pendingAppsCount = pendingAppsQuery.data ?? 0;
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const raw = window.localStorage.getItem('pupen_admin_nav_groups_v1');
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {}
    const next: Record<string, boolean> = {};
    for (const g of menuGroups) next[g.title] = true;
    return next;
  });

  const toggleGroup = (title: string) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [title]: !prev[title] };
      try {
        window.localStorage.setItem('pupen_admin_nav_groups_v1', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full bg-stone-900 text-stone-300">
      {/* BRAND */}
      <div className="p-6 border-b border-stone-800 flex items-center justify-between">
        <Link href={`/${lang}`} className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-900/40 shrink-0">
            <ShieldCheck size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white leading-none">Pupen</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-green-500 mt-1">Control</p>
          </div>
        </Link>
        <button onClick={() => setIsMobileOpen(false)} className="lg:hidden p-2 hover:bg-stone-800 rounded-lg">
          <X size={20} />
        </button>
      </div>

      {/* USER PROFILE */}
      <div className="p-6 border-b border-stone-800">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-10 h-10 bg-stone-800 rounded-full flex items-center justify-center font-black text-green-500 border border-stone-700">
            {userProfile?.first_name?.charAt(0) || userProfile?.email?.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">{userProfile?.first_name} {userProfile?.last_name}</p>
            <p className="text-[10px] font-medium text-stone-500 truncate">{userProfile?.email}</p>
          </div>
        </div>
      </div>

      {/* NAVIGATION */}
      <nav className="flex-grow overflow-y-auto custom-scrollbar-dark p-4 space-y-8">
        {menuGroups.map((group, gIdx) => {
          const visibleItems = group.items.filter((item) => item.visible);
          if (visibleItems.length === 0) return null;
          const isOpen = openGroups[group.title] !== false;

          return (
            <div key={gIdx} className="space-y-2">
              <button
                type="button"
                onClick={() => toggleGroup(group.title)}
                className="w-full flex items-center justify-between px-4 py-2 rounded-xl hover:bg-stone-800 transition"
              >
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-stone-600">{group.title}</span>
                <ChevronDown
                  size={14}
                  className={`text-stone-600 transition-transform ${isOpen ? 'rotate-0' : '-rotate-90'}`}
                />
              </button>
              {isOpen && (
                <div className="space-y-1">
                  {visibleItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      onTabChange(item.id);
                      setIsMobileOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 group ${
                      activeTab === item.id 
                        ? 'bg-green-600 text-white shadow-lg shadow-green-900/20' 
                        : 'hover:bg-stone-800 hover:text-white'
                    }`}
                  >
                    <item.icon size={18} className={activeTab === item.id ? 'text-white' : 'text-stone-500 group-hover:text-green-500'} />
                    <span className="flex-grow text-left">{item.label}</span>
                    {item.id === 'apps' && pendingAppsCount > 0 ? (
                      <span className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border border-amber-400/30 bg-amber-400/10 text-amber-200">
                        {pendingAppsCount}
                      </span>
                    ) : null}
                    {activeTab === item.id && <ChevronRight size={14} className="opacity-50" />}
                  </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* FOOTER */}
      <div className="p-4 border-t border-stone-800 space-y-2">
        {userProfile?.is_member && (
          <Link 
            href={`/${lang}/clen`}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold text-blue-400 hover:bg-blue-500/10 transition"
          >
            <ShieldCheck size={18} />
            <span>Členský portál</span>
          </Link>
        )}
        <button 
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold text-red-400 hover:bg-red-500/10 transition"
        >
          <LogOut size={18} />
          <span>Odhlásit se</span>
        </button>
      </div>
    </div>
  );
};

export default function AdminSidebar({ 
  lang, dict, activeTab, onTabChange, userProfile, permissions, onLogout,
}: AdminSidebarProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const commonProps = {
    lang, dict, activeTab, onTabChange, userProfile, permissions, onLogout,
    setIsMobileOpen
  };

  return (
    <>
      {/* MOBILE HAMBURGER */}
      <div className="lg:hidden fixed top-4 left-4 z-[60]">
        <button 
          onClick={() => setIsMobileOpen(true)}
          className="p-3 bg-stone-900 text-white rounded-xl shadow-xl border border-stone-800"
        >
          <Menu size={24} />
        </button>
      </div>

      {/* SIDEBAR DESKTOP */}
      <aside className="hidden lg:block w-72 fixed left-0 top-0 bottom-0 shrink-0 shadow-2xl z-[10000]">
        <SidebarContent {...commonProps} />
      </aside>

      {/* SIDEBAR MOBILE OVERLAY */}
      {isMobileOpen && (
        <Drawer
          open={isMobileOpen}
          onClose={() => setIsMobileOpen(false)}
          side="left"
          overlayClassName="lg:hidden fixed inset-0 z-[100] flex"
          backdropClassName="absolute inset-0 bg-black/60 backdrop-blur-sm"
          panelClassName="relative w-72 h-full animate-in slide-in-from-left duration-300"
        >
          <SidebarContent {...commonProps} />
        </Drawer>
      )}
    </>
  );
}
