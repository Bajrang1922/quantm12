/**
 * POST /api/trades/modify
 * Modify follower orders (SL, target, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';

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
    const { masterOrderId, modification } = body;

    if (!masterOrderId || !modification) {
      return NextResponse.json(
        { ok: false, message: 'masterOrderId and modification are required' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    if (!db) {
      return NextResponse.json(
        { ok: false, message: 'Database connection failed' },
        { status: 500 }
      );
    }

    console.log(`[MODIFY] Processing modification for master order: ${masterOrderId}`);

    // Get all active order mappings for this master order
    const mappings = await db.query(
      `SELECT * FROM order_mappings WHERE master_order_id = ? AND status IN ('ACTIVE', 'PARTIAL')`,
      [masterOrderId]
    );

    const results = [];

    for (const mapping of mappings) {
      try {
        // TODO: Call Alice Blue API to modify the follower order
        // For now, we'll just log the modification

        console.log(`[MODIFY] Modifying order ${mapping.follower_order_id} for follower ${mapping.follower_id}:`, modification);

        // Record modification in mapping
        await db.query(
          `UPDATE order_mappings SET updated_at = NOW() WHERE id = ?`,
          [mapping.id]
        );

        results.push({
          follower_id: mapping.follower_id,
          follower_order_id: mapping.follower_order_id,
          status: 'SUCCESS',
          message: 'Order modification recorded',
        });
      } catch (error: any) {
        results.push({
          follower_id: mapping.follower_id,
          follower_order_id: mapping.follower_order_id,
          status: 'FAILED',
          message: error.message,
        });
      }
    }

    const successful = results.filter(r => r.status === 'SUCCESS').length;
    const failed = results.filter(r => r.status === 'FAILED').length;

    return NextResponse.json({
      ok: true,
      message: 'Order modifications processed',
      masterOrderId,
      summary: {
        total_orders: results.length,
        successful,
        failed,
      },
      results,
    });
  } catch (error: any) {
    console.error('[MODIFY-ERROR]', error);
    return NextResponse.json(
      { ok: false, message: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
