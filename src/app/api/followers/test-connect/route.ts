import { NextRequest, NextResponse } from 'next/server';
import { getTradesForAccount, getAccountToken } from '@/lib/alice';

export async function GET(req: NextRequest) {
  try {
    const followerId = req.nextUrl.searchParams.get('followerId');
    if (!followerId) return NextResponse.json({ ok: false, message: 'followerId required' }, { status: 400 });

    // Check token exists
    const token = getAccountToken(followerId);
    if (!token) return NextResponse.json({ ok: false, message: 'No token found for follower' }, { status: 404 });

    // Try fetching a small trades payload to verify connection
    try {
      const trades = await getTradesForAccount(followerId);
      return NextResponse.json({ ok: true, message: 'Connected', sampleCount: (trades || []).length });
    } catch (e: any) {
      console.warn('Test connect failed for', followerId, e);
      return NextResponse.json({ ok: false, message: e?.message || 'Connection failed' }, { status: 502 });
    }
  } catch (err: any) {
    console.error('Test connect error:', err);
    return NextResponse.json({ ok: false, message: err?.message || 'Unknown error' }, { status: 500 });
  }
}
