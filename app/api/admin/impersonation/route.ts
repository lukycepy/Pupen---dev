import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperadmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { getPublicBaseUrl } from '@/lib/public-base-url';

const BodySchema = z.object({
  targetUserId: z.string().uuid(),
  lang: z.enum(['cs', 'en']).default('cs'),
  destination: z.enum(['admin', 'member']).default('member'),
});

interface GenerateLinkData {
  properties?: { action_link?: string | null } | null;
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function getRedirectPath(lang: 'cs' | 'en', destination: 'admin' | 'member') {
  return destination === 'admin' ? `/${lang}/admin/dashboard` : `/${lang}/clen`;
}

function toPublicVerifyUrl(actionUrl: string, baseUrl: string) {
  return `${baseUrl.replace(/\/$/, '')}/api/auth/verify?u=${encodeURIComponent(actionUrl)}`;
}

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireSuperadmin(req);
    const actorEmail = normalizeEmail((profile as { email?: string | null } | null)?.email || user.email || '');
    if (actorEmail !== 'cepelak@pupen.org') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = BodySchema.parse(await req.json().catch(() => ({})));
    if (body.targetUserId === user.id) {
      return NextResponse.json({ error: 'Nelze převzít vlastní účet.' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const targetRes = await supabase
      .from('profiles')
      .select('id,email,first_name,last_name')
      .eq('id', body.targetUserId)
      .maybeSingle<{ id?: string | null; email?: string | null; first_name?: string | null; last_name?: string | null }>();
    if (targetRes.error) throw targetRes.error;

    const targetEmail = normalizeEmail(targetRes.data?.email);
    if (!targetEmail) {
      return NextResponse.json({ error: 'Cílový uživatel nemá e-mail pro přihlášení.' }, { status: 400 });
    }

    const baseUrl = getPublicBaseUrl();
    const targetRedirectTo = `${baseUrl}${getRedirectPath(body.lang, body.destination)}`;
    const restoreRedirectTo = `${baseUrl}/cs/admin/dashboard`;

    const [impersonateLink, restoreLink] = await Promise.all([
      supabase.auth.admin.generateLink({
        type: 'recovery',
        email: targetEmail,
        options: { redirectTo: targetRedirectTo },
      }),
      supabase.auth.admin.generateLink({
        type: 'recovery',
        email: actorEmail,
        options: { redirectTo: restoreRedirectTo },
      }),
    ]);

    if (impersonateLink.error) throw impersonateLink.error;
    if (restoreLink.error) throw restoreLink.error;

    const impersonateActionUrl = String(((impersonateLink.data as GenerateLinkData | null)?.properties?.action_link) || '');
    const restoreActionUrl = String(((restoreLink.data as GenerateLinkData | null)?.properties?.action_link) || '');
    if (!impersonateActionUrl || !restoreActionUrl) {
      throw new Error('Missing impersonation link');
    }

    return NextResponse.json({
      ok: true,
      impersonateUrl: toPublicVerifyUrl(impersonateActionUrl, baseUrl),
      restoreUrl: toPublicVerifyUrl(restoreActionUrl, baseUrl),
      originalEmail: actorEmail,
      target: {
        id: String(targetRes.data?.id || ''),
        email: targetEmail,
        firstName: String(targetRes.data?.first_name || ''),
        lastName: String(targetRes.data?.last_name || ''),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
