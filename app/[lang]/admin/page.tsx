'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, Lock, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import InlinePulse from '@/app/components/InlinePulse';

export default function AdminLogin() {
  const router = useRouter();
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'guest' | 'admin' | 'member' | 'forbidden'>('guest');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (!session) {
          if (mounted) {
            setStatus('guest');
            setLoading(false);
          }
          return;
        }

        const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
        const isSuperAdmin = session.user.email === 'cepelak@pupen.org';
        const isAdmin = !!(prof?.is_admin || prof?.can_manage_admins) || isSuperAdmin;
        const isMember = !!(prof?.is_member || prof?.is_admin || prof?.can_view_member_portal || prof?.can_edit_member_portal) || isSuperAdmin;

        if (isAdmin) {
          router.replace(`/${lang}/admin/dashboard`);
          return;
        }
        if (isMember) {
          router.replace(`/${lang}/clen`);
          return;
        }

        if (mounted) {
          setStatus('forbidden');
          setLoading(false);
        }
      } catch {
        if (mounted) {
          setStatus('guest');
          setLoading(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [lang, router]);

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace(`/${lang}/login`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
      <div className="bg-white p-12 rounded-[3rem] shadow-2xl w-full max-w-md text-center border border-stone-100">
        <div className="flex justify-center mb-8">
          <div className="bg-green-50 p-5 rounded-full shadow-inner">
            <ShieldCheck className="w-10 h-10 text-green-600" />
          </div>
        </div>

        <h1 className="text-3xl font-black text-stone-900 mb-2 tracking-tight">Pupen Control</h1>
        <p className="text-stone-500 mb-10 font-medium">Administrace a správa portálu.</p>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <InlinePulse className="bg-stone-200" size={18} />
          </div>
        ) : status === 'forbidden' ? (
          <div className="space-y-4">
            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100">
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">Nemáte oprávnění</div>
              <div className="text-stone-700 font-bold mt-2">Váš účet nemá přístup do admin portálu.</div>
            </div>
            <button
              onClick={logout}
              className="w-full bg-stone-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-stone-800 transition shadow-lg flex items-center justify-center gap-2"
            >
              <LogOut size={18} /> Odhlásit se
            </button>
            <Link href={`/${lang}`} className="block w-full text-stone-400 font-bold hover:text-stone-600 transition text-sm py-2">
              Zpět na web
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <Link
              href={`/${lang}/login`}
              className="w-full bg-green-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-green-700 transition shadow-xl shadow-green-600/20 flex items-center justify-center gap-2"
            >
              <Lock size={18} /> Přihlásit se
            </Link>
            <Link href={`/${lang}`} className="block w-full text-stone-400 font-bold hover:text-stone-600 transition text-sm py-2">
              Zpět na web
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
