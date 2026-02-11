import { NextResponse, NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * Debug endpoint to check OAuth token status
 * GET /api/alice/oauth-debug
 */
export async function GET(req: NextRequest) {
  try {
    const TOKENS_FILE = process.env.ALICE_OAUTH_TOKENS_FILE || '.alice.tokens.json';
    const MASTER_FILE = process.env.QUANTUM_MASTER_ACCOUNT_FILE || '.master.account';
    const INCOMING_FILE = process.env.QUANTUM_ALPHA_INCOMING_FILE || '.alice.incoming.json';

    const tokenPath = path.join(process.cwd(), TOKENS_FILE);
    const masterPath = path.join(process.cwd(), MASTER_FILE);
    const incomingPath = path.join(process.cwd(), INCOMING_FILE);

    // Check files
    const tokensExist = fs.existsSync(tokenPath);
    const masterExist = fs.existsSync(masterPath);
    const incomingExist = fs.existsSync(incomingPath);

    let tokens: Record<string, string> = {};
    let masterAccount: string | null = null;
    let incomingTrades: Record<string, any> = {};

    if (tokensExist) {
      try {
        tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
      } catch (e) {
        console.error('Failed parsing tokens file:', e);
      }
    }

    if (masterExist) {
      try {
        masterAccount = fs.readFileSync(masterPath, 'utf-8').trim();
      } catch (e) {
        console.error('Failed reading master account file:', e);
      }
    }

    if (incomingExist) {
      try {
        incomingTrades = JSON.parse(fs.readFileSync(incomingPath, 'utf-8'));
      } catch (e) {
        console.error('Failed parsing incoming file:', e);
      }
    }

    return NextResponse.json({
      ok: true,
      debug: {
        files: {
          tokens: {
            path: tokenPath,
            exists: tokensExist,
            count: Object.keys(tokens).length,
            accounts: Object.keys(tokens).map(k => ({
              accountId: k,
              tokenMask: tokens[k] ? `${tokens[k].substring(0, 8)}...${tokens[k].substring(tokens[k].length - 8)}` : 'empty'
            }))
          },
          master: {
            path: masterPath,
            exists: masterExist,
            accountId: masterAccount
          },
          incoming: {
            path: incomingPath,
            exists: incomingExist,
            accounts: Object.keys(incomingTrades).map(k => ({
              accountId: k,
              tradeCount: Array.isArray(incomingTrades[k]) ? incomingTrades[k].length : 0
            }))
          }
        },
        oauth: {
          endpoint: process.env.ALICE_OAUTH_TRADES_ENDPOINT || 'https://ant.aliceblueonline.com/open-api/od/v1/trades',
          apiEndpoint: process.env.ALICE_TRADES_ENDPOINT || process.env.ALICE_API_BASE_URL || 'NOT_CONFIGURED'
        },
        status: {
          hasTokens: Object.keys(tokens).length > 0,
          hasMasterAccount: !!masterAccount,
          hasTrades: Object.keys(incomingTrades).length > 0
        }
      }
    });
  } catch (err: any) {
    console.error('Debug error:', err);
    return NextResponse.json({
      ok: false,
      error: err?.message ?? 'Unknown error'
    }, { status: 500 });
  }
}
