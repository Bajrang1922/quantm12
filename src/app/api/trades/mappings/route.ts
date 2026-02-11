/**
 * GET /api/trades/mappings
 * Query order mappings
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
    const followerId = req.nextUrl.searchParams.get('followerId');
    const status = req.nextUrl.searchParams.get('status');

    let query = 'SELECT * FROM order_mappings WHERE 1=1';
    const params: any[] = [];

    if (masterOrderId) {
      query += ' AND master_order_id = ?';
      params.push(masterOrderId);
    }

    if (followerId) {
      query += ' AND follower_id = ?';
      params.push(followerId);
    }

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const mappings = await db.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM order_mappings WHERE 1=1';
    const countParams: any[] = [];

    if (masterOrderId) {
      countQuery += ' AND master_order_id = ?';
      countParams.push(masterOrderId);
    }

    if (followerId) {
      countQuery += ' AND follower_id = ?';
      countParams.push(followerId);
    }

    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }

    const countResult = await db.query(countQuery, countParams);
    const total = countResult[0]?.total || 0;

    return NextResponse.json({
      ok: true,
      mappings: mappings.map((m: any) => ({
        id: m.id,
        master_order_id: m.master_order_id,
        follower_id: m.follower_id,
        follower_order_id: m.follower_order_id,
        symbol: m.symbol,
        side: m.side,
        quantity: m.quantity,
        executed_quantity: m.executed_quantity,
        status: m.status,
        error_message: m.error_message,
        created_at: m.created_at,
        updated_at: m.updated_at,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error: any) {
    console.error('Mappings query error:', error);
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 500 }
    );
  }
}
