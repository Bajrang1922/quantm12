import { NextResponse, NextRequest } from 'next/server';
import { getMasterTrades } from '@/lib/alice';

export async function GET(req: NextRequest) {
  try {
    const trades = await getMasterTrades();
    return NextResponse.json({ 
      trades,
      count: trades.length,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Failed to sync Alice trades:', error);
    const msg = error?.message ?? 'Unknown error';

    const m = msg.match(/HTTP (\d{3})/);
    const status = m ? Number(m[1]) : 500;

    return NextResponse.json({ error: msg }, { status });
  }
}
