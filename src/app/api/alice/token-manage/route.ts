import { NextResponse, NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

const TOKENS_FILE = '.alice.tokens.json';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-qa-secret');
  const expectedSecret = process.env.QUANTUM_ALPHA_SECRET || 'testsecret';

  if (secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { accountId, token, action } = body;

    if (!accountId || !token) {
      return NextResponse.json(
        { error: 'Missing accountId or token' },
        { status: 400 }
      );
    }

    // Read existing tokens
    let tokens: Record<string, string> = {};
    if (fs.existsSync(TOKENS_FILE)) {
      try {
        tokens = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf-8'));
      } catch (e) {
        console.warn('Failed to parse tokens file');
      }
    }

    if (action === 'set' || !action) {
      // Save token
      tokens[accountId] = token;
      fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
      
      const masked = `${token.slice(0, 6)}...${token.slice(-4)}`;
      return NextResponse.json({
        ok: true,
        message: `Token saved for account ${accountId}`,
        tokenMasked: masked,
        accountId,
      });
    } else if (action === 'delete') {
      // Delete token
      if (tokens[accountId]) {
        delete tokens[accountId];
        fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
      }
      return NextResponse.json({
        ok: true,
        message: `Token deleted for account ${accountId}`,
      });
    } else {
      return NextResponse.json(
        { error: `Unknown action: ${action}. Use 'set' or 'delete'` },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('[TOKEN-MANAGE] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET to view all stored tokens (masked)
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-qa-secret');
  const expectedSecret = process.env.QUANTUM_ALPHA_SECRET || 'testsecret';

  if (secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let tokens: Record<string, string> = {};
    if (fs.existsSync(TOKENS_FILE)) {
      try {
        tokens = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf-8'));
      } catch (e) {
        console.warn('Failed to parse tokens file');
      }
    }

    const masked: Record<string, string> = {};
    for (const [accountId, token] of Object.entries(tokens)) {
      masked[accountId] = `${token.slice(0, 6)}...${token.slice(-4)}`;
    }

    return NextResponse.json({
      ok: true,
      tokensFile: TOKENS_FILE,
      storedTokens: masked,
      totalAccounts: Object.keys(tokens).length,
      usage: {
        post_set: 'POST with {"accountId": "...", "token": "..."}',
        post_delete: 'POST with {"accountId": "...", "action": "delete"}',
        fetch_trades: 'Use /api/alice/fetch-live with token',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
