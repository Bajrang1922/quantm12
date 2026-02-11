/**
 * GET /api/trade-events
 * Fetch real-time trade events and system logs from database
 * Requires x-qa-secret header for admin access
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    // Check for admin secret
    const secret = req.headers.get('x-qa-secret');
    const envSecret = process.env.QUANTUM_ALPHA_SECRET;

    if (!secret || !envSecret || secret !== envSecret) {
      return NextResponse.json(
        { ok: false, message: 'Unauthorized: invalid or missing x-qa-secret' },
        { status: 401 }
      );
    }

    const db = await getDatabase();
    if (!db) {
      return NextResponse.json(
        { ok: false, message: 'Database connection failed' },
        { status: 500 }
      );
    }

    // Fetch trade events from database - real-time logs
    const events = await db.query(
      `
      SELECT 
        id,
        event_type,
        master_order_id,
        follower_id,
        status,
        message,
        quantity,
        risk_validated,
        created_at as timestamp
      FROM trade_events
      ORDER BY created_at DESC
      LIMIT 100
      `
    ) as Array<any>;

    // Format events for display
    const logs = events.map((evt: any) => ({
      id: evt.id,
      timestamp: new Date(evt.timestamp).toLocaleString(),
      level: evt.status === 'error' ? 'Error' : evt.status === 'warning' ? 'Warning' : 'Info',
      message: evt.message || `${evt.event_type}: ${evt.master_order_id} → ${evt.follower_id}`,
      eventType: evt.event_type,
      masterOrderId: evt.master_order_id,
      followerId: evt.follower_id,
      quantity: evt.quantity,
      riskValidated: evt.risk_validated,
    }));

    return NextResponse.json({
      ok: true,
      count: logs.length,
      logs,
    });
  } catch (error: any) {
    console.error('Trade events error:', error);
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 500 }
    );
  }
}
