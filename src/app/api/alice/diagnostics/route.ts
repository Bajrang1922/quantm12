import { NextResponse, NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

const TOKENS_FILE = process.env.ALICE_OAUTH_TOKENS_FILE || '.alice.tokens.json';
const MASTER_FILE = process.env.QUANTUM_MASTER_ACCOUNT_FILE || '.master.account';
const INCOMING_FILE = process.env.QUANTUM_ALPHA_INCOMING_FILE || '.alice.incoming.json';
const TOKEN_MASK_LENGTH = 20;

function maskToken(token: string): string {
  if (!token) return '';
  if (token.length <= TOKEN_MASK_LENGTH) return '***';
  return token.substring(0, 10) + '**...**' + token.substring(token.length - 10);
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-qa-secret');
  const expectedSecret = process.env.QUANTUM_ALPHA_SECRET || 'testsecret';
  
  if (secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      files: {},
      environment: {
        ALICE_OAUTH_TRADES_ENDPOINT: process.env.ALICE_OAUTH_TRADES_ENDPOINT || 'not-set',
        ALICE_TRADES_ENDPOINT: process.env.ALICE_TRADES_ENDPOINT || 'not-set',
        nodeEnv: process.env.NODE_ENV,
      },
    };

    // Check tokens file
    try {
      if (fs.existsSync(TOKENS_FILE)) {
        const content = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf-8') || '{}');
        diagnostics.files.tokens = {
          exists: true,
          accounts: Object.keys(content),
          tokensMasked: Object.entries(content).reduce((acc: any, [k, v]: any) => {
            acc[k] = maskToken(v);
            return acc;
          }, {}),
        };
      } else {
        diagnostics.files.tokens = { exists: false, path: TOKENS_FILE };
      }
    } catch (e: any) {
      diagnostics.files.tokens = { error: e.message };
    }

    // Check master account file
    try {
      if (fs.existsSync(MASTER_FILE)) {
        const masterAccountId = fs.readFileSync(MASTER_FILE, 'utf-8').trim();
        diagnostics.files.masterAccount = {
          exists: true,
          accountId: masterAccountId,
        };
      } else {
        diagnostics.files.masterAccount = { exists: false, path: MASTER_FILE };
      }
    } catch (e: any) {
      diagnostics.files.masterAccount = { error: e.message };
    }

    // Check incoming trades file
    try {
      if (fs.existsSync(INCOMING_FILE)) {
        const incomingData = JSON.parse(fs.readFileSync(INCOMING_FILE, 'utf-8') || '{}');
        const summary: any = {};
        for (const [account, trades] of Object.entries(incomingData)) {
          if (Array.isArray(trades)) {
            summary[account] = {
              count: trades.length,
              symbols: trades.map((t: any) => t.symbol).slice(0, 5),
            };
          }
        }
        diagnostics.files.incoming = {
          exists: true,
          accounts: Object.keys(incomingData),
          summary,
        };
      } else {
        diagnostics.files.incoming = { exists: false, path: INCOMING_FILE };
      }
    } catch (e: any) {
      diagnostics.files.incoming = { error: e.message };
    }

    // Recommendations
    diagnostics.recommendations = [];
    
    if (!diagnostics.files.tokens?.exists) {
      diagnostics.recommendations.push({
        issue: 'No OAuth tokens found',
        action: 'Users need to connect via OAuth at /api/alice/oauth/vendor/start',
      });
    }

    if (!diagnostics.files.masterAccount?.exists) {
      diagnostics.recommendations.push({
        issue: 'No master account configured',
        action: 'Create .master.account file or set QUANTUM_MASTER_ACCOUNT_FILE env var',
      });
    }

    if (!diagnostics.files.incoming?.exists) {
      diagnostics.recommendations.push({
        issue: 'No incoming trades cache found',
        action: 'Use browser extension to scrape trades or call /api/alice/poll to fetch trades',
      });
    } else if (
      Object.values(diagnostics.files.incoming.summary || {}).every((s: any) => s.count === 0)
    ) {
      diagnostics.recommendations.push({
        issue: 'Incoming trades cache is empty',
        action: 'Users need to place trades in Alice Blue or use extension to scrape existing trades',
      });
    }

    return NextResponse.json(diagnostics);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
