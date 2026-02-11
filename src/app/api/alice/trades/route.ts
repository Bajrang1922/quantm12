import { NextResponse, NextRequest } from 'next/server';
import { getTradesForAccount } from '@/lib/alice';
import fs from 'fs';
import path from 'path';

const INCOMING_FILE = process.env.QUANTUM_ALPHA_INCOMING_FILE || '.alice.incoming.json';
const MASTER_FILE = process.env.QUANTUM_MASTER_ACCOUNT_FILE || '.master.account';

function readMasterAccountId(): string | null {
  try {
    if (fs.existsSync(MASTER_FILE)) {
      const content = fs.readFileSync(MASTER_FILE, 'utf-8').trim();
      return content || null;
    }
  } catch (e) {
    console.warn('[TRADES] Failed reading master account file', e);
  }
  return null;
}

function readIncomingTrades(): Record<string, any[]> {
  try {
    if (fs.existsSync(INCOMING_FILE)) {
      const data = JSON.parse(fs.readFileSync(INCOMING_FILE, 'utf-8') || '{}');
      return data;
    }
  } catch (e) {
    console.warn('[TRADES] Failed reading incoming file', e);
  }
  return {};
}

export async function GET(req: NextRequest) {
  try {
    const accountId = new URL(req.url).searchParams.get('accountId') || undefined;
    const masterAccountFileId = readMasterAccountId();
    const effectiveAccountId = accountId || masterAccountFileId || 'Master';
    
    console.log(`[TRADES_ROUTE] Fetching trades for accountId=${accountId}, effectiveAccountId=${effectiveAccountId}`);
    
    const trades = await getTradesForAccount(accountId);
    
    console.log(`[TRADES_ROUTE] OAuth fetch returned ${trades.length} trades`);
    
    // Log sample trades with timestamps
    if (trades.length > 0) {
      console.log(`[TRADES_ROUTE] First trade timestamp: ${trades[0].timestamp}`);
      const timestampSamples = trades.slice(0, 3).map((t, i) => ({
        index: i,
        symbol: t.symbol,
        timestamp: t.timestamp,
        rawTimestamp: t.exchangeTimestamp,
      }));
      console.log('[TRADES_ROUTE] Sample timestamps:', timestampSamples);
    }
    
    // If OAuth returned empty trades, check the incoming/cached trades file
    if (trades.length === 0) {
      console.log(`[TRADES_ROUTE] OAuth returned 0 trades for ${effectiveAccountId}, checking incoming cache...`);
      const incomingData = readIncomingTrades();
      
      // Check multiple possible keys: the provided accountId, master from file, or any available trades
      let cachedTrades: any[] = [];
      
      // Try exact account ID match first
      if (accountId && incomingData[accountId]) {
        cachedTrades = incomingData[accountId];
        console.log(`[TRADES_ROUTE] Found ${cachedTrades.length} cached trades for accountId=${accountId}`);
      }
      // Try master account file ID
      else if (masterAccountFileId && incomingData[masterAccountFileId]) {
        cachedTrades = incomingData[masterAccountFileId];
        console.log(`[TRADES_ROUTE] Found ${cachedTrades.length} cached trades for masterAccountFileId=${masterAccountFileId}`);
      }
      // Try "Master" key (common default)
      else if (incomingData['Master']) {
        cachedTrades = incomingData['Master'];
        console.log(`[TRADES_ROUTE] Found ${cachedTrades.length} cached trades for key='Master'`);
      }
      // Try "master_account" key
      else if (incomingData['master_account']) {
        cachedTrades = incomingData['master_account'];
        console.log(`[TRADES_ROUTE] Found ${cachedTrades.length} cached trades for key='master_account'`);
      }
      // If still empty, try to get the first available account's trades
      else {
        const availableAccounts = Object.keys(incomingData);
        if (availableAccounts.length > 0) {
          cachedTrades = incomingData[availableAccounts[0]] || [];
          console.log(`[TRADES_ROUTE] Using first available account: ${availableAccounts[0]} with ${cachedTrades.length} trades`);
        }
      }
      
      if (cachedTrades.length > 0) {
        console.log(`[TRADES_ROUTE] Returning ${cachedTrades.length} trades from incoming cache`);
        return NextResponse.json({ trades: cachedTrades, source: 'incoming-cache' });
      }
    }
    
    return NextResponse.json({ trades, source: 'oauth' });
  } catch (error: any) {
    console.error('[TRADES_ROUTE] Failed to fetch Alice trades:', error);
    const msg = error?.message ?? 'Unknown error';

    const m = msg.match(/HTTP (\d{3})/);
    const status = m ? Number(m[1]) : 500;

    return NextResponse.json({ error: msg }, { status });
  }
}
