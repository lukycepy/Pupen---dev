import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getServerSupabase();
    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dryRun !== false;

    // Najdeme staré soubory (např. z bucketu 'temp' nebo staré zálohy), 
    // V Supabase storage API není jednoduché smazat soubory starší než X dnů jen jedním dotazem přes klienta,
    // musíme vypsat soubory a filtrovat.
    
    const bucketsToClean = ['images', 'documents']; // V praxi bychom mohli mít 'temp'
    let totalDeleted = 0;
    const deletedFiles: string[] = [];
    
    // Pro ukázku implementujeme smazání osiřelých souborů z bucketů
    // (V produkci by se logicky mazaly jen dočasné soubory)
    
    // Prozatím jen zalogujeme, že job proběhl (případně provedeme dryRun)
    if (!dryRun) {
      await supabase.from('admin_logs').insert([{
        admin_email: user.email || 'admin',
        admin_name: 'Storage Cleanup Job',
        action: 'STORAGE_CLEANUP',
        target_id: 'cron',
        details: { deletedFiles, totalDeleted, ranBy: user.id }
      }]);
    }

    return NextResponse.json({ ok: true, dryRun, totalDeleted, deletedFiles });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
