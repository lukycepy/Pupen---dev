import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const supabase = getServerSupabase();

    const safeCount = async (q: any) => {
      try {
        const res = await q;
        if (res?.error) return 0;
        return typeof res.count === 'number' ? res.count : 0;
      } catch {
        return 0;
      }
    };

    const [active, pending, unsubscribed, bounced] = await Promise.all([
      safeCount(supabase.from('newsletter_subscriptions').select('id', { count: 'exact', head: true }).eq('consent', true)),
      safeCount(
        supabase
          .from('newsletter_subscriptions')
          .select('id', { count: 'exact', head: true })
          .eq('consent', false)
          .is('unsubscribed_at', null)
          .not('doi_token_hash', 'is', null),
      ),
      safeCount(supabase.from('newsletter_subscriptions').select('id', { count: 'exact', head: true }).not('unsubscribed_at', 'is', null)),
      safeCount(supabase.from('email_bounces').select('email', { count: 'exact', head: true })),
    ]);

    return NextResponse.json({ ok: true, metrics: { active, pending, unsubscribed, bounced } });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

