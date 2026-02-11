import { NextResponse, NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getTradesForAccount } from '@/lib/alice';
// import { broadcastTrade } from '../trades/route';

const TOKENS_FILE = process.env.ALICE_OAUTH_TOKENS_FILE || '.alice.tokens.json';
const INCOMING_FILE = process.env.QUANTUM_ALPHA_INCOMING_FILE || '.alice.incoming.json';
const MASTER_FILE = process.env.QUANTUM_MASTER_ACCOUNT_FILE || '.master.account';

function readMasterAccountId(): string | null {
  try {
    if (fs.existsSync(MASTER_FILE)) {
      const content = fs.readFileSync(MASTER_FILE, 'utf-8').trim();
      return content || null;
    }
  } catch (e) {
    console.warn('Failed reading master account file', e);
  }
  return null;
}

function readTokens(): Record<string, string> {
  try {
    if (fs.existsSync(TOKENS_FILE)) {
      return JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf-8') || '{}');
    }
  } catch (e) {
    console.error('Failed reading tokens file', e);
  }
  return {};
}

function readIncoming(): Record<string, any[]> {
  try {
    if (fs.existsSync(INCOMING_FILE)) {
      return JSON.parse(fs.readFileSync(INCOMING_FILE, 'utf-8') || '{}');
    }
  } catch (e) {
    console.error('Failed reading incoming file', e);
  }
  return {};
}

function writeIncoming(data: Record<string, any[]>) {
  try {
    fs.writeFileSync(INCOMING_FILE, JSON.stringify(data, null, 2), { encoding: 'utf-8', flag: 'w' });
  } catch (e) {
    console.error('Failed writing incoming file', e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const tokens = readTokens();
    const accountIds = Object.keys(tokens);
    
    if (accountIds.length === 0) {
      console.warn('[POLL] No accounts found in tokens file');
      return NextResponse.json({ ok: true, message: 'no accounts', newTrades: 0 });
    }
    
    console.log(`[POLL] Starting poll for ${accountIds.length} account(s):`, accountIds);
    
    // Prioritize master account polling
    const masterAccountId = readMasterAccountId();
    const sortedAccountIds = masterAccountId && accountIds.includes(masterAccountId)
      ? [masterAccountId, ...accountIds.filter(id => id !== masterAccountId)]
      : accountIds;

    const incoming = readIncoming();

    let totalNew = 0;
    for (const accId of sortedAccountIds) {
      try {
        console.log(`[POLL] Fetching trades for account: ${accId}`);
        const trades = await getTradesForAccount(accId);
        console.log(`[POLL] Received ${trades.length} trades for ${accId}`);
        
        incoming[accId] = incoming[accId] || [];
        const existingIds = new Set((incoming[accId] || []).map(t => t.id));
        const newTrades = [];
        trades.forEach(t => {
          const id = t.id || `A-${Date.now()}-${Math.floor(Math.random()*100000)}`;
          if (!existingIds.has(id)) {
            const tr = { ...t, id };
            incoming[accId].push(tr);
            newTrades.push(tr);
            totalNew++;
          }
        });

        console.log(`[POLL] Added ${newTrades.length} new trades for ${accId}`);

        // Broadcast new trades (TODO: implement broadcasting)
        // newTrades.forEach(nt => broadcastTrade({ ...nt, account: accId, isMaster: accId === masterAccountId }));
      } catch (e) {
        console.error(`[POLL] Failed fetching trades for ${accId}:`, e);
      }
    }

    writeIncoming(incoming);
    console.log(`[POLL] Complete - ${totalNew} total new trades added`);
    return NextResponse.json({ ok: true, newTrades: totalNew, accountsPolled: sortedAccountIds.length });
  } catch (err: any) {
    console.error('[POLL] Error', err);
    return NextResponse.json({ ok: false, message: err?.message ?? 'Unknown error' }, { status: 500 });
  }
}
