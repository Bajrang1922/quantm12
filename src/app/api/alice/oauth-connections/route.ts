import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const TOKENS_FILE = process.env.ALICE_OAUTH_TOKENS_FILE || '.alice.tokens.json';
const MASTER_FILE = process.env.QUANTUM_MASTER_ACCOUNT_FILE || '.master.account';
const INCOMING_FILE = process.env.QUANTUM_ALPHA_INCOMING_FILE || '.alice.incoming.json';

interface OAuthConnection {
  accountId: string;
  connected: boolean;
  connectedAt?: string;
  isMaster: boolean;
  tradeCount: number;
  status: 'connected' | 'disconnected' | 'expired';
}

function readTokens(): Record<string, string> {
  try {
    const tokensPath = path.join(process.cwd(), TOKENS_FILE);
    if (fs.existsSync(tokensPath)) {
      return JSON.parse(fs.readFileSync(tokensPath, 'utf-8') || '{}');
    }
  } catch (e) {
    console.warn('Failed reading tokens file:', e);
  }
  return {};
}

function getMasterAccountId(): string | null {
  try {
    const masterPath = path.join(process.cwd(), MASTER_FILE);
    if (fs.existsSync(masterPath)) {
      return fs.readFileSync(masterPath, 'utf-8').trim();
    }
  } catch (e) {
    console.warn('Failed reading master account file:', e);
  }
  return null;
}

function getTradeCount(accountId: string): number {
  try {
    const incomingPath = path.join(process.cwd(), INCOMING_FILE);
    if (fs.existsSync(incomingPath)) {
      const incoming = JSON.parse(fs.readFileSync(incomingPath, 'utf-8') || '{}');
      return Array.isArray(incoming[accountId]) ? incoming[accountId].length : 0;
    }
  } catch (e) {
    console.warn('Failed reading incoming file:', e);
  }
  return 0;
}

/**
 * GET /api/alice/oauth-connections
 * List all connected OAuth accounts
 */
export async function GET() {
  try {
    const tokens = readTokens();
    const masterAccountId = getMasterAccountId();

    const connections: OAuthConnection[] = Object.keys(tokens).map((accountId) => ({
      accountId,
      connected: true,
      isMaster: accountId === masterAccountId,
      tradeCount: getTradeCount(accountId),
      status: 'connected',
      connectedAt: new Date().toISOString(),
    }));

    console.log(`[OAUTH-CONNECTIONS] Found ${connections.length} connected accounts`);

    return NextResponse.json({
      ok: true,
      connections,
      totalConnected: connections.length,
      masterAccount: masterAccountId,
    });
  } catch (error: any) {
    console.error('[OAUTH-CONNECTIONS] Error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message ?? 'Unknown error' },
      { status: 500 }
    );
  }
}
