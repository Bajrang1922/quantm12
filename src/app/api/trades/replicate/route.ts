/**
 * POST /api/trades/replicate
 * Master trade replication endpoint
 * 
 * Accepts master trade data and replicates to all active followers
 * based on their risk configurations
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
    // Verify secret (optional - same as push endpoint)
    const secret = req.headers.get('x-qa-secret');
    const expectedSecret = process.env.QUANTUM_ALPHA_SECRET;

    if (expectedSecret && secret !== expectedSecret) {
      return NextResponse.json(
        { ok: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { trade, eventType = 'PLACE' } = body;

    if (!trade) {
      return NextResponse.json(
        { ok: false, message: 'Trade data is required' },
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

    console.log(`[REPLICATE] Processing ${eventType} trade:`, masterTrade);

    // Replicate to followers
    const results = await replicateTradeToFollowers(masterTrade, generateId());

    // Record trade event
    const eventId = await recordTradeEvent(
      masterTrade,
      eventType as any,
      results
    );

    const successful = results.filter(r => r.status === 'SUCCESS').length;
    const failed = results.filter(r => r.status === 'FAILED').length;
    const skipped = results.filter(r => r.status === 'SKIPPED').length;

    console.log(
      `[REPLICATE-SUMMARY] Event ${eventId}: ${successful} successful, ${failed} failed, ${skipped} skipped`
    );

    return NextResponse.json({
      ok: true,
      message: 'Trade replicated successfully',
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
    console.error('[REPLICATE-ERROR]', error);
    return NextResponse.json(
      { ok: false, message: error.message || 'Server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/trades/replicate?masterOrderId=XXX
 * Get replication status for a master order
 */
export async function GET(req: NextRequest) {
  try {
    const masterOrderId = req.nextUrl.searchParams.get('masterOrderId');

    if (!masterOrderId) {
      return NextResponse.json(
        { ok: false, message: 'masterOrderId is required' },
        { status: 400 }
      );
    }

    const { getOrderMappings } = await import('@/lib/replication-engine');
    const mappings = await getOrderMappings(masterOrderId);

    return NextResponse.json({
      ok: true,
      masterOrderId,
      mappings: mappings.map((m: any) => ({
        id: m.id,
        follower_id: m.follower_id,
        follower_order_id: m.follower_order_id,
        symbol: m.symbol,
        side: m.side,
        quantity: m.quantity,
        executed_quantity: m.executed_quantity,
        status: m.status,
        created_at: m.created_at,
        updated_at: m.updated_at,
      })),
    });
  } catch (error: any) {
    console.error('[REPLICATE-GET-ERROR]', error);
    return NextResponse.json(
      { ok: false, message: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
