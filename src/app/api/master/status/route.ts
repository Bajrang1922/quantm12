import { NextResponse, NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

const MASTER_FILE = process.env.QUANTUM_MASTER_ACCOUNT_FILE || '.master.account';
const TOKENS_FILE = process.env.ALICE_OAUTH_TOKENS_FILE || '.alice.tokens.json';

function readMasterAccountId(): string | null {
  try {
    const p = path.join(process.cwd(), MASTER_FILE);
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf-8').trim();
      return content || null;
    }
  } catch (e) {
    console.warn('Failed reading master account file', e);
  }
  return null;
}

function writeMasterAccountId(accountId: string) {
  try {
    const p = path.join(process.cwd(), MASTER_FILE);
    fs.writeFileSync(p, accountId, { encoding: 'utf-8', flag: 'w' });
  } catch (e) {
    console.error('Failed writing master account file', e);
  }
}

function readTokens(): Record<string, string> {
  try {
    const p = path.join(process.cwd(), TOKENS_FILE);
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf-8') || '{}');
    }
  } catch (e) {
    console.error('Failed reading tokens file', e);
  }
  return {};
}

export async function GET(req: NextRequest) {
  try {
    const masterAccountId = readMasterAccountId();
    
    if (!masterAccountId) {
      return NextResponse.json({
        ok: true,
        master: null,
      });
    }

    const tokens = readTokens();
    const token = tokens[masterAccountId];

    if (!token) {
      return NextResponse.json({
        ok: true,
        master: null,
      });
    }

    return NextResponse.json({
      ok: true,
      master: {
        userId: masterAccountId,
        tokenMask: `${token.slice(0, 10)}...${token.slice(-4)}`,
      },
    });
  } catch (error: any) {
    console.error('[MASTER-STATUS-ERROR]', error);
    return NextResponse.json(
      { ok: false, message: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
