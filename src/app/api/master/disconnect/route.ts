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

function deleteMasterAccountId() {
  try {
    const p = path.join(process.cwd(), MASTER_FILE);
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
    }
  } catch (e) {
    console.error('Failed deleting master account file', e);
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

function writeTokens(tokens: Record<string, string>) {
  try {
    const p = path.join(process.cwd(), TOKENS_FILE);
    fs.writeFileSync(p, JSON.stringify(tokens, null, 2), { encoding: 'utf-8', flag: 'w' });
  } catch (e) {
    console.error('Failed writing tokens file', e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const masterAccountId = readMasterAccountId();

    // Remove master account reference
    deleteMasterAccountId();

    // Optionally, also remove the token
    if (masterAccountId) {
      const tokens = readTokens();
      delete tokens[masterAccountId];
      writeTokens(tokens);
    }

    return NextResponse.json({
      ok: true,
      message: 'Master account disconnected',
    });
  } catch (error: any) {
    console.error('[MASTER-DISCONNECT-ERROR]', error);
    return NextResponse.json(
      { ok: false, message: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
