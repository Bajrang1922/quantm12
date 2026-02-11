/**
 * GET /api/followers/test-oauth-token?followerId=...
 * Test if an OAuth token is valid by making a test call to the broker API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import crypto from 'crypto';

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
      return NextResponse.json(
        { ok: false, message: 'No OAuth token found for this follower' },
        { status: 404 }
      );
    }

    const token = tokens[0];
    const decryptedToken = decryptSensitive(token.access_token);

    // Test the token by making a call to AliceBlue API
    try {
      const endpoint = process.env.ALICE_TRADES_ENDPOINT || '/open-api/od/v1/orders/trades';
      const baseUrl = process.env.ALICE_API_BASE_URL || 'https://ant.aliceblueonline.com';

      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${decryptedToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json({
          ok: true,
          message: 'Token is valid and connection successful',
          status: data.status,
          tradeCount: Array.isArray(data.result) ? data.result.length : 0,
        });
      } else if (response.status === 401 || response.status === 403) {
        return NextResponse.json(
          { ok: false, message: 'Token is invalid or expired' },
          { status: 401 }
        );
      } else {
        const errorData = await response.json();
        return NextResponse.json(
          { ok: false, message: `API error: ${errorData.message || response.statusText}` },
          { status: response.status }
        );
      }
    } catch (apiError: any) {
      return NextResponse.json(
        { ok: false, message: `Failed to connect to broker API: ${apiError.message}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('OAuth token test error:', error);
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 500 }
    );
  }
}
