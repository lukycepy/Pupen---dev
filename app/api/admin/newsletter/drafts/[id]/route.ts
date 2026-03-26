import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await ctx.params;
    const body = await req.json();
    const { subject, body_html, target_categories, status } = body;
    const ab_enabled = body?.ab_enabled;
    const subject_b = body?.subject_b;
    const ab_split = body?.ab_split;

    const supabase = getServerSupabase();
    
    const updates: any = { updated_at: new Date().toISOString() };
    if (subject !== undefined) updates.subject = subject;
    if (subject_b !== undefined) updates.subject_b = subject_b;
    if (ab_enabled !== undefined) updates.ab_enabled = !!ab_enabled;
    if (ab_split !== undefined) updates.ab_split = ab_split;
    if (body_html !== undefined) updates.body_html = body_html;
    if (target_categories !== undefined) updates.target_categories = target_categories;
    if (status !== undefined) updates.status = status;

    const { data, error } = await supabase
      .from('newsletter_drafts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ draft: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await ctx.params;
    const supabase = getServerSupabase();
    
    const { error } = await supabase
      .from('newsletter_drafts')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
