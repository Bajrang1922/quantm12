/**
 * POST /api/followers/consent
 * Record follower consent for trade replication
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { generateId } from '@/lib/replication-engine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { followerId, consentToken } = body;

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

    const consentId = generateId();
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Insert or update consent record
    await db.query(
      `
      INSERT INTO follower_consents 
      (id, follower_id, trade_replication_enabled, consent_given_at, consent_token, ip_address, user_agent, created_at)
      VALUES (?, ?, TRUE, NOW(), ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE 
        trade_replication_enabled = TRUE,
        consent_given_at = NOW(),
        consent_token = VALUES(consent_token),
        ip_address = VALUES(ip_address),
        user_agent = VALUES(user_agent)
      `,
      [consentId, followerId, consentToken || generateId(), ip, userAgent]
    );

    return NextResponse.json({
      ok: true,
      message: 'Consent recorded successfully',
      consentId,
    });
  } catch (error: any) {
    console.error('Consent error:', error);
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 500 }
    );
  }
}

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
      `SELECT * FROM follower_consents WHERE follower_id = ?`,
      [followerId]
    ) as Array<any>;

    const consent = rows[0] || null;

    return NextResponse.json({
      ok: true,
      consent: consent
        ? {
            follower_id: consent.follower_id,
            enabled: consent.trade_replication_enabled,
            consentGivenAt: consent.consent_given_at,
          }
        : null,
    });
  } catch (error: any) {
    console.error('Consent retrieval error:', error);
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 500 }
    );
  }
}
