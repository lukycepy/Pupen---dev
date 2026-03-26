import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { listEmailTemplates } from '@/lib/email/templates';

function isSchemaCacheMissingTable(e: any) {
  const msg = String(e?.message || '');
  return msg.includes('Could not find the table') && msg.includes('in the schema cache');
}

function allowedKeys() {
  return new Set(listEmailTemplates().map((t) => String(t.key)));
}

export async function DELETE(req: Request, ctx: { params: Promise<{ templateKey: string }> }) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { templateKey } = await ctx.params;
    const key = String(templateKey || '').trim();
    const allowed = allowedKeys();
    if (!allowed.has(key)) return NextResponse.json({ error: 'Invalid template key' }, { status: 400 });

    const supabase = getServerSupabase();
    const del = await supabase.from('email_template_overrides').delete().eq('template_key', key);
    if (del.error) throw del.error;

    await supabase
      .from('admin_logs')
      .insert([
        {
          admin_email: user.email || 'admin',
          admin_name: user.user_metadata?.full_name || user.email || 'admin',
          action: 'EMAIL_TEMPLATE_DELETE',
          target_id: key,
          details: { template_key: key },
        },
      ])
      .throwOnError();

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (isSchemaCacheMissingTable(e)) {
      return NextResponse.json(
        { error: 'Chybí tabulka email_template_overrides. Spusť migraci `migrace/38_email_template_overrides.sql` v Supabase.' },
        { status: 501 },
      );
    }
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

