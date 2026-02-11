/**
 * GET /api/admin/settings
 * POST /api/admin/settings
 * Manage risk management and lots settings
 * Requires x-qa-secret header
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';

interface Settings {
  max_quantity_per_trade: number;
  max_daily_loss_percentage: number;
  min_lot_size: number;
  default_lot_multiplier: number;
  auto_liquidate_on_loss: boolean;
  max_concurrent_trades: number;
  auto_replicate_new_trades: boolean;
}

export async function GET(req: NextRequest) {
  try {
    const secret = req.headers.get('x-qa-secret');
    const envSecret = process.env.QUANTUM_ALPHA_SECRET;

    if (!secret || !envSecret || secret !== envSecret) {
      return NextResponse.json(
        { ok: false, message: 'Unauthorized' },
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

    // Get master settings
    const settings = await db.query(
      `
      SELECT *
      FROM master_settings
      LIMIT 1
      `
    ) as Array<any>;

    const config = settings[0] || {
      max_quantity_per_trade: 1000,
      max_daily_loss_percentage: 5,
      min_lot_size: 1,
      default_lot_multiplier: 1,
      auto_liquidate_on_loss: false,
      max_concurrent_trades: 10,
      auto_replicate_new_trades: true,
    };

    return NextResponse.json({
      ok: true,
      settings: config,
    });
  } catch (error: any) {
    console.error('Settings fetch error:', error);
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get('x-qa-secret');
    const envSecret = process.env.QUANTUM_ALPHA_SECRET;

    if (!secret || !envSecret || secret !== envSecret) {
      return NextResponse.json(
        { ok: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      maxQuantityPerTrade,
      maxDailyLossPercentage,
      minLotSize,
      defaultLotMultiplier,
      autoLiquidateOnLoss,
      maxConcurrentTrades,
      autoReplicateNewTrades,
    } = body;

    const db = await getDatabase();
    if (!db) {
      return NextResponse.json(
        { ok: false, message: 'Database connection failed' },
        { status: 500 }
      );
    }

    // Delete old and insert new
    await db.query('DELETE FROM master_settings');
    await db.query(
      `
      INSERT INTO master_settings
      (max_quantity_per_trade, max_daily_loss_percentage, min_lot_size, default_lot_multiplier, auto_liquidate_on_loss, max_concurrent_trades, auto_replicate_new_trades, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
      `,
      [
        maxQuantityPerTrade,
        maxDailyLossPercentage,
        minLotSize,
        defaultLotMultiplier,
        autoLiquidateOnLoss ? 1 : 0,
        maxConcurrentTrades,
        autoReplicateNewTrades ? 1 : 0,
      ]
    );

    return NextResponse.json({
      ok: true,
      message: 'Settings updated successfully',
    });
  } catch (error: any) {
    console.error('Settings save error:', error);
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 500 }
    );
  }
}
