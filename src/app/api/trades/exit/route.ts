/**
 * POST /api/trades/exit
 * Exit all follower positions for a master order
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncExitOrder } from '@/lib/replication-engine';

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get('x-qa-secret');
    const expectedSecret = process.env.QUANTUM_ALPHA_SECRET;

    if (expectedSecret && secret !== expectedSecret) {
      return NextResponse.json(
        { ok: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { masterOrderId } = body;

    if (!masterOrderId) {
      return NextResponse.json(
        { ok: false, message: 'masterOrderId is required' },
        { status: 400 }
      );
    }

    console.log(`[EXIT] Processing exit for master order: ${masterOrderId}`);

    const results = await syncExitOrder(masterOrderId);

    const successful = results.filter(r => r.status === 'SUCCESS').length;
    const failed = results.filter(r => r.status === 'FAILED').length;

    return NextResponse.json({
      ok: true,
      message: 'Exit order processed successfully',
      masterOrderId,
      summary: {
        total_followers: results.length,
        successful,
        failed,
      },
      results: results.map(r => ({
        follower_id: r.follower_id,
        status: r.status,
        reason: r.reason,
      })),
    });
  } catch (error: any) {
    console.error('[EXIT-ERROR]', error);
    return NextResponse.json(
      { ok: false, message: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
