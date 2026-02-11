import { NextResponse, NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

const TOKENS_FILE = process.env.ALICE_OAUTH_TOKENS_FILE || '.alice.tokens.json';

interface OAuthConnection {
  accountId: string;
  connected: boolean;
  connectedAt?: string;
  expiresAt?: string;
  status: 'connected' | 'disconnected' | 'expired';
}

function getAccountToken(accountId: string): string | undefined {
  if (!accountId) return undefined;
  try {
    const tokensPath = path.join(process.cwd(), TOKENS_FILE);
    if (fs.existsSync(tokensPath)) {
      const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf-8') || '{}');
      return tokens[accountId];
    }
  } catch (e) {
    console.warn('Failed reading tokens file:', e);
  }
  return undefined;
}

/**
 * GET /api/alice/oauth-status
 * Check OAuth connection status for current user
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const accountId = url.searchParams.get('accountId');

    if (!accountId) {
      return NextResponse.json(
        { ok: false, message: 'accountId query parameter required' },
        { status: 400 }
      );
    }

    const token = getAccountToken(accountId);
    const connected = !!token;

    const connection: OAuthConnection = {
      accountId,
      connected,
      status: connected ? 'connected' : 'disconnected',
      connectedAt: connected ? new Date().toISOString() : undefined,
    };

    console.log(`[OAUTH-STATUS] Account ${accountId}: ${connection.status}`);

    return NextResponse.json({
      ok: true,
      connection,
    });
  } catch (error: any) {
    console.error('[OAUTH-STATUS] Error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message ?? 'Unknown error' },
      { status: 500 }
    );
  }
}
