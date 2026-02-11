/**
 * POST /api/followers/copy-trading-toggle
 * Enable or disable copy trading for a follower
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { generateId } from '@/lib/replication-engine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { followerId, enabled } = body;

    if (!followerId || enabled === undefined) {
      return NextResponse.json(
        { ok: false, message: 'followerId and enabled are required' },
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

    // Check if follower exists
    const followers = await db.query(
      `SELECT id FROM followers WHERE id = ?`,
      [followerId]
    ) as Array<any>;

    if (!followers || followers.length === 0) {
      return NextResponse.json(
        { ok: false, message: 'Follower not found' },
        { status: 404 }
      );
    }

    // Update or create follower_consents record
    const existingConsent = await db.query(
      `SELECT id FROM follower_consents WHERE follower_id = ?`,
      [followerId]
    ) as Array<any>;

    if (existingConsent && existingConsent.length > 0) {
      // Update existing record
      await db.query(
        `
        UPDATE follower_consents 
        SET copy_trading_active = ?, updated_at = NOW()
        WHERE follower_id = ?
        `,
        [enabled ? 1 : 0, followerId]
      );
    } else {
      // Create new consent record
      const consentId = generateId();
      await db.query(
        `
        INSERT INTO follower_consents 
        (id, follower_id, trade_replication_enabled, copy_trading_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, NOW(), NOW())
        `,
        [consentId, followerId, enabled ? 1 : 0, enabled ? 1 : 0]
      );
    }

    console.log(`[COPY_TRADING] ${enabled ? 'Enabled' : 'Disabled'} copy trading for ${followerId}`);

    // Fetch and return updated consent
    const updatedConsent = await db.query(
      `SELECT * FROM follower_consents WHERE follower_id = ?`,
      [followerId]
    ) as Array<any>;

    return NextResponse.json({
      ok: true,
      message: `Copy trading ${enabled ? 'enabled' : 'disabled'} for ${followerId}`,
      copyTradingActive: enabled,
      consent: updatedConsent[0] || {},
    });
  } catch (error: any) {
    console.error('Copy trading toggle error:', error);
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 500 }
    );
  }
}
