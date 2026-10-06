import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

interface SitePublicConfigFeaturesRow {
  features?: Record<string, unknown> | null;
  pages?: Record<string, unknown> | null;
}

interface SitePublicConfigFeaturesUpdate {
  features?: Record<string, unknown>;
  pages?: Record<string, unknown>;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function GET(req: Request) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('site_public_config')
      .select('features, pages')
      .eq('id', 1)
      .single<SitePublicConfigFeaturesRow>();

    if (error) throw error;
    return NextResponse.json({
      features: toRecord(data?.features),
      pages: toRecord(data?.pages),
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(req: Request) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const supabase = getServerSupabase();

    const updates: SitePublicConfigFeaturesUpdate = {};
    if (body.features !== undefined) updates.features = toRecord(body.features);
    if (body.pages !== undefined) updates.pages = toRecord(body.pages);

    const { data, error } = await supabase
      .from('site_public_config')
      .update(updates)
      .eq('id', 1)
      .select()
      .single<SitePublicConfigFeaturesRow>();

    if (error) throw error;
    return NextResponse.json({
      success: true,
      config: {
        features: toRecord(data?.features),
        pages: toRecord(data?.pages),
      },
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
