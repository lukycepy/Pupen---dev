import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getBearerToken } from '@/lib/server-auth';
import { guardPublicJsonPost } from '@/lib/public-post-guard';
import { sanitizeLogMessage, sanitizeLogUrl } from '@/lib/logs/sanitize';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function POST(req: Request) {
  try {
    const g = await guardPublicJsonPost(req, {
      keyPrefix: 'err_log',
      windowMs: 60_000,
      max: 20,
      honeypot: false,
      tooManyMessage: 'Too many errors reported',
      forbiddenMessage: 'Forbidden',
    });
    if (!g.ok) return g.response;
    const body = g.body;
    const { level = 'error', message, stack, url, user_agent } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    
    let user_id: string | null = null;
    const token = getBearerToken(req);
    if (token) {
      const r = await supabase.auth.getUser(token);
      user_id = r.data?.user?.id || null;
    }

    const { error } = await supabase
      .from('error_logs')
      .insert([{
        level: sanitizeLogMessage(level || 'error').slice(0, 20),
        message: sanitizeLogMessage(message).substring(0, 2000), // Limit length
        stack: stack ? sanitizeLogMessage(stack).substring(0, 5000) : null,
        url: url ? sanitizeLogUrl(url).substring(0, 1000) : null,
        user_agent: user_agent ? sanitizeLogMessage(user_agent).substring(0, 1000) : null,
        user_id
      }]);

    if (error) {
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Forbidden' ? 403 : message === 'Too many errors reported' ? 429 : 500;
    return NextResponse.json({ error: status === 500 ? 'Internal Server Error' : message }, { status });
  }
}
