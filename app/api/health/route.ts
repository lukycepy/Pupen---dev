import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs'; // Use nodejs runtime for memoryUsage and uptime metrics

export async function GET() {
  const start = Date.now();
  try {
    // Check database connection
    const { data, error } = await supabase.from('site_settings').select('id').limit(1);
    const end = Date.now();
    const dbLatency = end - start;
    
    if (error) {
      console.error('Healthcheck DB Error:', error);
      return NextResponse.json(
        { status: 'error', message: 'Database connection failed', timestamp: new Date().toISOString() },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: 'ok',
      message: 'System is healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      metrics: {
        dbLatencyMs: dbLatency,
        memoryUsage: process.memoryUsage ? process.memoryUsage().rss : 'unknown',
        uptime: process.uptime ? process.uptime() : 'unknown'
      }
    });
  } catch (error) {
    console.error('Healthcheck Error:', error);
    return NextResponse.json(
      { status: 'error', message: 'Internal Server Error', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
