/**
 * POST /api/followers/credentials
 * Add or update follower credentials
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { generateId } from '@/lib/replication-engine';
import crypto from 'crypto';

/**
 * Encrypt sensitive data
 */
function encryptSensitive(data: string, key = process.env.ENCRYPTION_KEY): string {
  if (!key) return data; // Fallback if no encryption key
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
    return data; // Return as-is if decryption fails
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { followerId, clientId, apiKey, accessToken, brokerSessionId } = body;

    // Accept followerId and accessToken as mandatory; clientId/apiKey may be optional for OAuth flows
    if (!followerId || !accessToken) {
      return NextResponse.json(
        { ok: false, message: 'Missing required fields: followerId, accessToken' },
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

    // Check if follower exists, if not create it
    try {
      const existingFollower = await db.query(
        `SELECT id FROM followers WHERE id = ?`,
        [followerId]
      ) as Array<any>;

      if (!existingFollower || existingFollower.length === 0) {
        // Create follower with minimal fields - other attributes come from copy trading config
        await db.query(
          `INSERT INTO followers (id, name, status, created_at) VALUES (?, ?, 'Active', NOW())`,
          [followerId, `Follower ${followerId}`]
        );
        console.log(`[CREDENTIALS] Auto-created follower: ${followerId}`);
      }
    } catch (followerError: any) {
      console.error(`[CREDENTIALS] Failed to create follower ${followerId}:`, followerError.message);
      throw new Error(`Failed to create follower account: ${followerError.message}`);
    }

    const credentialId = generateId();

    // Encrypt sensitive fields
    const encryptedApiKey = encryptSensitive(apiKey || '');
    const encryptedAccessToken = encryptSensitive(accessToken);

    // Insert credential record
    await db.query(
      `
      INSERT INTO follower_credentials 
      (id, follower_id, client_id, api_key, access_token, broker_session_id, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', NOW(), NOW())
      ON DUPLICATE KEY UPDATE 
        client_id = VALUES(client_id),
        api_key = VALUES(api_key),
        access_token = VALUES(access_token),
        broker_session_id = VALUES(broker_session_id),
        updated_at = NOW()
      `,
      [
        credentialId,
        followerId,
        clientId || '',
        encryptedApiKey,
        encryptedAccessToken,
        brokerSessionId || null,
      ]
    );

    console.log(`[CREDENTIALS] Added/updated credentials for follower: ${followerId}`);

    // Also persist access token to token file for polling/broadcasting compatibility
    try {
      const TOKENS_FILE = process.env.ALICE_OAUTH_TOKENS_FILE || '.alice.tokens.json';
      const tf = require('path').join(process.cwd(), TOKENS_FILE);
      let tokens: Record<string, string> = {};
      if (require('fs').existsSync(tf)) {
        try { tokens = JSON.parse(require('fs').readFileSync(tf, 'utf-8') || '{}'); } catch(e) { tokens = {}; }
      }
      if (accessToken) {
        tokens[followerId] = accessToken;
        require('fs').writeFileSync(tf, JSON.stringify(tokens, null, 2), { encoding: 'utf-8', flag: 'w' });
      }
    } catch (e) {
      console.warn('Failed writing access token to tokens file', e);
    }

    return NextResponse.json({
      ok: true,
      message: 'Credentials saved successfully',
      credentialId,
    });
  } catch (error: any) {
    console.error('Credentials error:', error);
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
      `SELECT * FROM follower_credentials WHERE follower_id = ?`,
      [followerId]
    );

    const credential = rows[0];
    if (!credential) {
      return NextResponse.json(
        { ok: false, message: 'Credentials not found' },
        { status: 404 }
      );
    }

    // Decrypt sensitive fields for display (masked)
    const decryptedApiKey = decryptSensitive(credential.api_key);
    const decryptedAccessToken = decryptSensitive(credential.access_token);

    return NextResponse.json({
      ok: true,
      credential: {
        follower_id: credential.follower_id,
        client_id: credential.client_id,
        api_key_last4: decryptedApiKey.slice(-4),
        access_token_last4: decryptedAccessToken.slice(-4),
        status: credential.status,
        created_at: credential.created_at,
      },
    });
  } catch (error: any) {
    console.error('Credentials retrieval error:', error);
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 500 }
    );
  }
}
