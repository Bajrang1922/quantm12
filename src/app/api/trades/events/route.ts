/**
 * GET /api/trades/events
 * Query trade events and replication status
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const db = await getDatabase();
    if (!db) {
      return NextResponse.json(
        { ok: false, message: 'Database connection failed' },
        { status: 500 }
      );
    }

    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '50'), 200);
    const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0');
    const masterOrderId = req.nextUrl.searchParams.get('masterOrderId');
    const eventType = req.nextUrl.searchParams.get('eventType');

    let query = 'SELECT * FROM trade_events WHERE 1=1';
    const params: any[] = [];

    if (masterOrderId) {
      query += ' AND master_order_id = ?';
      params.push(masterOrderId);
    }

    if (eventType) {
      query += ' AND event_type = ?';
      params.push(eventType);
    }

    query += ' ORDER BY processed_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const events = await db.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM trade_events WHERE 1=1';
    const countParams: any[] = [];

    if (masterOrderId) {
      countQuery += ' AND master_order_id = ?';
      countParams.push(masterOrderId);
    }

    if (eventType) {
      countQuery += ' AND event_type = ?';
      countParams.push(eventType);
    }

    const countResult = await db.query(countQuery, countParams);
    const total = countResult[0]?.total || 0;

    return NextResponse.json({
      ok: true,
      events: events.map((e: any) => ({
        id: e.id,
        master_order_id: e.master_order_id,
        event_type: e.event_type,
        symbol: e.symbol,
        side: e.side,
        quantity: e.quantity,
        total_followers: e.total_followers,
        successful_followers: e.successful_followers,
        failed_followers: e.failed_followers,
        skipped_followers: e.skipped_followers,
        processed_at: e.processed_at,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error: any) {
    console.error('Events query error:', error);
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 500 }
    );
  }
}
