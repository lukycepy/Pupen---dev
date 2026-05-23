import { getServerSupabase } from '@/lib/supabase-server';
import { sanitizeLogMessage, sanitizeLogUrl, sanitizeLogValue } from '@/lib/logs/sanitize';

export async function writeServerLog(input: {
  level?: string;
  category?: string;
  message: string;
  data?: any;
  requestId?: string | null;
  userId?: string | null;
  req?: Request | null;
}) {
  const level = sanitizeLogMessage(input.level || 'info').slice(0, 20);
  const category = sanitizeLogMessage(input.category || 'app').slice(0, 60);
  const message = sanitizeLogMessage(input.message).slice(0, 4000);
  const data = input.data == null ? null : sanitizeLogValue(input.data);
  const request_id = input.requestId ? sanitizeLogMessage(input.requestId).slice(0, 200) : null;
  const user_id = input.userId ? sanitizeLogMessage(input.userId).slice(0, 200) : null;

  let method: string | null = null;
  let url: string | null = null;
  let ip: string | null = null;
  let user_agent: string | null = null;

  const req = input.req;
  if (req) {
    method = sanitizeLogMessage(req.method).slice(0, 20);
    url = sanitizeLogUrl(req.url).slice(0, 1000);
    user_agent = sanitizeLogMessage(req.headers.get('user-agent') || '').slice(0, 500);
    const fwd = req.headers.get('x-forwarded-for') || '';
    ip = sanitizeLogMessage(String(fwd.split(',')[0] || '').trim()).slice(0, 100);
  }

  const supabase = getServerSupabase();
  await supabase.from('server_logs').insert([
    {
      level,
      category,
      message,
      data,
      request_id,
      user_id,
      method,
      url,
      ip,
      user_agent,
    },
  ]);
}
