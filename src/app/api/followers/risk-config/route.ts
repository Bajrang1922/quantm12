/**
 * GET/POST /api/followers/risk-config
 * Manage follower risk configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { generateId } from '@/lib/replication-engine';

export async function GET(req: NextRequest) {
  try {
    const followerId = req.nextUrl.searchParams.get('followerId');

    if (!followerId) {
      return NextResponse.json(
        { ok: false, message: 'followerId is required' },
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

    const rows = await db.query(
      `SELECT * FROM follower_risk_config WHERE follower_id = ?`,
      [followerId]
    );

    const config = rows[0];
    if (!config) {
      return NextResponse.json(
        { ok: false, message: 'Risk config not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      config: {
        follower_id: config.follower_id,
        lot_multiplier: config.lot_multiplier,
        max_quantity: config.max_quantity,
        max_order_value: config.max_order_value,
        max_daily_loss: config.max_daily_loss,
        allowed_instruments: config.allowed_instruments
          ? JSON.parse(config.allowed_instruments)
          : [],
        allowed_product_types: config.allowed_product_types
          ? JSON.parse(config.allowed_product_types)
          : [],
        allowed_order_types: config.allowed_order_types
          ? JSON.parse(config.allowed_order_types)
          : [],
        enabled: config.enabled,
      },
    });
  } catch (error: any) {
    console.error('Risk config retrieval error:', error);
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      followerId,
      lot_multiplier = 1.0,
      max_quantity = 100,
      max_order_value,
      max_daily_loss,
      allowed_instruments = [],
      allowed_product_types = ['MIS', 'CNC', 'NRML'],
      allowed_order_types = ['MARKET', 'LIMIT'],
      enabled = true,
    } = body;

    if (!followerId) {
      return NextResponse.json(
        { ok: false, message: 'followerId is required' },
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

    const configId = generateId();

    // Insert or update risk config
    await db.query(
      `
      INSERT INTO follower_risk_config 
      (id, follower_id, lot_multiplier, max_quantity, max_order_value, max_daily_loss, allowed_instruments, allowed_product_types, allowed_order_types, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE 
        lot_multiplier = VALUES(lot_multiplier),
        max_quantity = VALUES(max_quantity),
        max_order_value = VALUES(max_order_value),
        max_daily_loss = VALUES(max_daily_loss),
        allowed_instruments = VALUES(allowed_instruments),
        allowed_product_types = VALUES(allowed_product_types),
        allowed_order_types = VALUES(allowed_order_types),
        enabled = VALUES(enabled),
        updated_at = NOW()
      `,
      [
        configId,
        followerId,
        lot_multiplier,
        max_quantity,
        max_order_value,
        max_daily_loss,
        JSON.stringify(allowed_instruments),
        JSON.stringify(allowed_product_types),
        JSON.stringify(allowed_order_types),
        enabled ? 1 : 0,
      ]
    );

    return NextResponse.json({
      ok: true,
      message: 'Risk config updated successfully',
      configId,
    });
  } catch (error: any) {
    console.error('Risk config update error:', error);
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 500 }
    );
  }
}
