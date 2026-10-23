import { getServerSupabase } from '@/lib/supabase-server';
import { writeServerLog } from '@/lib/logs/server-logger';

type WebhookEvent = 'new_application' | 'new_message' | 'new_error' | 'new_member' | 'test';

export async function triggerWebhooks(event: WebhookEvent, payload: any) {
  try {
    const supabase = getServerSupabase();
    
    // Find active webhooks that subscribe to this event
    const { data: webhooks, error } = await supabase
      .from('webhooks')
      .select('url')
      .eq('is_active', true)
      .contains('events', [event]);

    if (error || !webhooks || webhooks.length === 0) return;

    // Prepare message (Discord/Slack compatible basic format)
    const content = `**Event:** ${event}\n**Data:**\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``;

    const promises = webhooks.map(wh => 
      fetch(wh.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      }).catch(err => {
        writeServerLog({
          level: 'error',
          category: 'webhook',
          message: `Webhook delivery failed: ${wh.url}`,
          data: { error: err instanceof Error ? err.message : String(err) },
        });
      })
    );

    await Promise.allSettled(promises);
  } catch (error) {
    writeServerLog({
      level: 'error',
      category: 'webhook',
      message: 'triggerWebhooks failed',
      data: { error: error instanceof Error ? error.message : String(error) },
    });
  }
}
