import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { level = 'error', message, stack, url, user_agent } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    
    // Get user id if authenticated
    const { data: { session } } = await supabase.auth.getSession();
    const user_id = session?.user?.id || null;

    const { error } = await supabase
      .from('error_logs')
      .insert([{
        level,
        message: String(message).substring(0, 2000), // Limit length
        stack: stack ? String(stack).substring(0, 5000) : null,
        url: url ? String(url).substring(0, 1000) : null,
        user_agent: user_agent ? String(user_agent).substring(0, 1000) : null,
        user_id
      }]);

    if (error) {
      console.error('Failed to write to error_logs:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    // Failsafe catch so we don't crash when logging an error
    console.error('Error in log API:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
