import { NextResponse, NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

const TOKENS_FILE = process.env.ALICE_OAUTH_TOKENS_FILE || '.alice.tokens.json';

function readTokens(): Record<string, string> {
  try {
    const tokensPath = path.join(process.cwd(), TOKENS_FILE);
    if (fs.existsSync(tokensPath)) {
      return JSON.parse(fs.readFileSync(tokensPath, 'utf-8') || '{}');
    }
  } catch (e) {
    console.error('Failed reading tokens file:', e);
  }
  return {};
}

function writeTokens(tokens: Record<string, string>) {
  try {
    const tokensPath = path.join(process.cwd(), TOKENS_FILE);
    fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2), { encoding: 'utf-8', flag: 'w' });
    console.log('[OAUTH-DISCONNECT] Tokens file updated');
  } catch (e) {
    console.error('Failed writing tokens file:', e);
    throw e;
  }
}

/**
 * POST /api/alice/oauth-disconnect
 * Revoke/disconnect OAuth connection for an account
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json(
        { ok: false, message: 'accountId is required' },
        { status: 400 }
      );
    }

    const tokens = readTokens();

    if (!tokens[accountId]) {
      return NextResponse.json(
        { ok: false, message: 'Account not connected' },
        { status: 404 }
      );
    }

    // Remove the token
    delete tokens[accountId];
    writeTokens(tokens);

    console.log(`[OAUTH-DISCONNECT] Account ${accountId} disconnected`);

    return NextResponse.json({
      ok: true,
      message: 'Account disconnected successfully',
    });
  } catch (error: any) {
    console.error('[OAUTH-DISCONNECT] Error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message ?? 'Unknown error' },
      { status: 500 }
    );
  }
}
