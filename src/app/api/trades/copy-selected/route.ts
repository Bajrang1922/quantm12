/**
 * POST /api/trades/copy-selected
 * Copy a master trade to selected followers
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  replicateTradeToFollowers,
  recordTradeEvent,
  MasterTrade,
  generateId,
} from '@/lib/replication-engine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { trade, follower_ids } = body;

    if (!trade) {
      return NextResponse.json(
        { ok: false, message: 'Trade data is required' },
        { status: 400 }
      );
    }

    if (!follower_ids || !Array.isArray(follower_ids) || follower_ids.length === 0) {
      return NextResponse.json(
        { ok: false, message: 'At least one follower must be selected' },
        { status: 400 }
      );
    }

    // Validate required fields
    const { id, symbol, side, quantity } = trade;
    if (!id || !symbol || !side || !quantity) {
      return NextResponse.json(
        { ok: false, message: 'Missing required trade fields: id, symbol, side, quantity' },
        { status: 400 }
      );
    }

    // Ensure valid side
    const validSide = side.toUpperCase() === 'SELL' ? 'SELL' : 'BUY';

    const masterTrade: MasterTrade = {
      id: trade.id || generateId(),
      symbol: trade.symbol,
      exchange: trade.exchange || 'NSE',
      side: validSide as 'BUY' | 'SELL',
      quantity: Number(trade.quantity),
      price: trade.price ? Number(trade.price) : undefined,
      product_type: trade.product_type || 'MIS',
      order_type: trade.order_type || 'MARKET',
      timestamp: trade.timestamp || new Date().toISOString(),
    };

    console.log(`[COPY-SELECTED] Processing trade:`, masterTrade);
    console.log(`[COPY-SELECTED] Target followers:`, follower_ids);

    // Replicate to selected followers only
    const results = await replicateTradeToFollowers(masterTrade, generateId(), follower_ids);

    // Record trade event
    const eventId = await recordTradeEvent(
      masterTrade,
      'PLACE',
      results
    );

    const successful = results.filter(r => r.status === 'SUCCESS').length;
    const failed = results.filter(r => r.status === 'FAILED').length;
    const skipped = results.filter(r => r.status === 'SKIPPED').length;

    console.log(
      `[COPY-SELECTED-SUMMARY] Event ${eventId}: ${successful} successful, ${failed} failed, ${skipped} skipped`
    );

    return NextResponse.json({
      ok: true,
      message: 'Trade copied successfully',
      eventId,
      master_order_id: masterTrade.id,
      summary: {
        total_followers: results.length,
        successful: successful,
        failed: failed,
        skipped: skipped,
      },
      results: results.map(r => ({
        follower_id: r.follower_id,
        status: r.status,
        reason: r.reason,
        follower_order_id: r.follower_order_id,
        executed_quantity: r.executed_quantity,
      })),
    });
  } catch (error: any) {
    console.error('[COPY-SELECTED-ERROR]', error);
    return NextResponse.json(
      { ok: false, message: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
