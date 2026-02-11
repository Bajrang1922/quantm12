/**
 * GET /api/followers/oauth-token?followerId=...
 * POST /api/followers/oauth-token - Save/Update OAuth token for a follower
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { generateId } from '@/lib/replication-engine';
import crypto from 'crypto';

/**
 * Encrypt sensitive data
 */
function encryptSensitive(data: string, key = process.env.ENCRYPTION_KEY): string {
  if (!key) return data;
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex').subarray(0, 32), iv);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (e) {
    console.warn('Encryption failed, storing plaintext');
    return data;
  }
}

/**
 * Decrypt sensitive data
 */
function decryptSensitive(data: string, key = process.env.ENCRYPTION_KEY): string {
  if (!key || !data.includes(':')) return data;
  try {
    const [ivHex, encryptedHex] = data.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex').subarray(0, 32), iv);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString();
  } catch (e) {
    return data;
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

    // Get token from oauth_tokens table
    const tokens = await db.query(
      `SELECT * FROM oauth_tokens WHERE account_id = ? AND provider = 'alice' ORDER BY created_at DESC LIMIT 1`,
      [followerId]
    ) as Array<any>;

    if (!tokens || tokens.length === 0) {
      return NextResponse.json({
        ok: true,
        token: null,
        message: 'No token found for this follower',
      });
    }

    const token = tokens[0];
    const decryptedToken = decryptSensitive(token.access_token);

    return NextResponse.json({
      ok: true,
      token: {
        id: token.id,
        account_id: token.account_id,
        provider: token.provider,
        access_token_masked: decryptedToken.length > 10
          ? decryptedToken.substring(0, 5) + '...' + decryptedToken.substring(decryptedToken.length - 4)
          : '****',
        expires_at: token.expires_at,
        created_at: token.created_at,
        updated_at: token.updated_at,
      },
    });
  } catch (error: any) {
    console.error('OAuth token retrieval error:', error);
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { followerId, accessToken, provider = 'alice' } = body;

    if (!followerId || !accessToken) {
      return NextResponse.json(
        { ok: false, message: 'followerId and accessToken are required' },
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

    // Generate token ID
    const tokenId = generateId();

    // Encrypt the access token
    const encryptedToken = encryptSensitive(accessToken);

    // Save to oauth_tokens table
    await db.query(
      `
      INSERT INTO oauth_tokens 
      (id, user_id, account_id, provider, access_token, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        access_token = VALUES(access_token),
        updated_at = NOW()
      `,
      [tokenId, followerId, followerId, provider, encryptedToken]
    );

    console.log(`[OAUTH_TOKEN] Saved token for follower: ${followerId}`);

    // Also update follower_credentials for backward compatibility
    try {
      const credId = generateId();
      await db.query(
        `
        INSERT INTO follower_credentials 
        (id, follower_id, access_token, status, created_at, updated_at)
        VALUES (?, ?, ?, 'ACTIVE', NOW(), NOW())
        ON DUPLICATE KEY UPDATE
          access_token = VALUES(access_token),
          updated_at = NOW()
        `,
        [credId, followerId, encryptedToken]
      );
    } catch (e) {
      console.warn('Failed to update follower_credentials:', e);
    }

    // Ensure follower_consents record exists
    try {
      const consents = await db.query(
        `SELECT id FROM follower_consents WHERE follower_id = ?`,
        [followerId]
      ) as Array<any>;

      if (!consents || consents.length === 0) {
        const consentId = generateId();
        await db.query(
          `INSERT INTO follower_consents (id, follower_id, trade_replication_enabled, copy_trading_active, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())`,
          [consentId, followerId, true, true]
        );
        console.log(`[OAUTH_TOKEN] Created consent record for ${followerId}`);
      }
    } catch (e) {
      console.warn('Failed to ensure consent record:', e);
    }

    return NextResponse.json({
      ok: true,
      message: 'OAuth token saved successfully',
      tokenId,
    });
  } catch (error: any) {
    console.error('OAuth token save error:', error);
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 500 }
    );
  }
}
