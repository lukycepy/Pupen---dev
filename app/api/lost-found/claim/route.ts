import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { guardPublicJsonPost } from '@/lib/public-post-guard';

const ITEM_STATUS = new Set(['open', 'claimed', 'in_progress', 'returned', 'archived']);

function normalizeStatus(input: any) {
  const s = String(input || '').trim();
  if (ITEM_STATUS.has(s)) return s;
  return 'open';
}

export async function POST(req: Request) {
  try {
    const g = await guardPublicJsonPost(req, {
      keyPrefix: 'lost_found_claim',
      windowMs: 10 * 60_000,
      max: 25,
      tooManyMessage: 'Příliš mnoho požadavků, zkuste to později.',
    });
    if (!g.ok) return g.response;

    const itemId = String(g.body?.itemId || '').trim();
    const email = String(g.body?.email || '').trim().slice(0, 320);
    const name = String(g.body?.name || '').trim().slice(0, 120);
    const message = String(g.body?.message || '').trim().slice(0, 2000);
    const isAnonymous = g.body?.isAnonymous === true;

    if (!itemId) return NextResponse.json({ error: 'Missing itemId' }, { status: 400 });
    if (!isAnonymous && !email) return NextResponse.json({ error: 'Chybí e-mail.' }, { status: 400 });
    if (!message) return NextResponse.json({ error: 'Chybí zpráva.' }, { status: 400 });

    const supabase = getServerSupabase();
    const itemRes = await supabase
      .from('lost_found_items')
      .select('id,title,status,is_public')
      .eq('id', itemId)
      .maybeSingle();
    if (itemRes.error) throw itemRes.error;
    const item: any = itemRes.data;
    if (!item?.id || item.is_public !== true) return NextResponse.json({ error: 'Položka nenalezena.' }, { status: 404 });

    const currentStatus = normalizeStatus(item.status);
    if (currentStatus === 'returned' || currentStatus === 'archived') {
      return NextResponse.json({ error: 'Položku už nelze nárokovat.' }, { status: 409 });
    }

    const nowIso = new Date().toISOString();
    const claimIns = await supabase
      .from('lost_found_claims')
      .insert([
        {
          item_id: itemId,
          name: isAnonymous ? null : name || null,
          email: isAnonymous ? null : email || null,
          message,
          is_anonymous: isAnonymous,
          status: 'claimed',
          updated_at: nowIso,
        },
      ])
      .select('id')
      .single();
    if (claimIns.error) throw claimIns.error;
    const claimId = String(claimIns.data?.id || '');

    if (currentStatus === 'open') {
      await supabase
        .from('lost_found_items')
        .update({ status: 'claimed', updated_at: nowIso })
        .eq('id', itemId);
    }

    // Ticket-like record for admin inbox compatibility
    await supabase.from('messages').insert([
      {
        name: isAnonymous ? 'Anonymní claim (Lost&Found)' : name || 'Claim (Lost&Found)',
        email: isAnonymous ? 'anonymous-claim@pupen.local' : email,
        subject: `Lost&Found claim: ${item.title || itemId}`,
        message: [
          `Claim ID: ${claimId}`,
          `Item ID: ${itemId}`,
          `Item title: ${item.title || ''}`,
          `Anonymous: ${isAnonymous ? 'yes' : 'no'}`,
          `Contact email: ${isAnonymous ? 'hidden' : email || 'n/a'}`,
          '',
          message,
        ].join('\n'),
      },
    ]);

    try {
      await supabase.from('admin_logs').insert([
        {
          admin_email: isAnonymous ? 'anonymous' : email || 'unknown',
          admin_name: 'LostFoundClaim',
          action: 'LOST_FOUND_CLAIM',
          target_id: itemId,
          details: { claimId, itemId, anonymous: isAnonymous, statusBefore: currentStatus, statusAfter: currentStatus === 'open' ? 'claimed' : currentStatus },
        },
      ]);
    } catch {}

    return NextResponse.json({ ok: true, claimId, itemStatus: currentStatus === 'open' ? 'claimed' : currentStatus });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}

