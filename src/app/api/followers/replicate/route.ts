import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getMasterTrades, pushOrderToAccount } from '@/lib/alice';
import { getDatabase } from '@/lib/db';
import { followerAccounts } from '@/lib/data';

const PUSHED_FILE = process.env.QUANTUM_MASTER_PUSHED_FILE || '.master.pushed.json';

function readPushed(): Set<string> {
  try {
    const p = path.join(process.cwd(), PUSHED_FILE);
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf-8') || '[]';
      const arr = JSON.parse(raw);
      return new Set(Array.isArray(arr) ? arr : []);
    }
  } catch (e) {
    console.warn('Failed reading pushed file', e);
  }
  return new Set();
}

function writePushed(set: Set<string>) {
  try {
    const p = path.join(process.cwd(), PUSHED_FILE);
    fs.writeFileSync(p, JSON.stringify(Array.from(set), null, 2), { encoding: 'utf-8', flag: 'w' });
  } catch (e) {
    console.error('Failed writing pushed file', e);
  }
}

async function postWithRetry(url: string, body: any, headers: Record<string,string> = {}, retries = 2) {
  let attempt = 0;
  while (attempt <= retries) {
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
      const text = await res.text().catch(() => '');
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
      try { return JSON.parse(text || '{}'); } catch { return { ok: true } }
    } catch (e) {
      if (attempt === retries) throw e;
      await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
      attempt++;
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    // optional secret to protect this endpoint
    const secret = req.headers.get('x-qa-secret');
    if (!process.env.QUANTUM_ALPHA_SECRET || secret !== process.env.QUANTUM_ALPHA_SECRET) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    // Expect FOLLOWER_PUSH_URLS to be a JSON string mapping followerId -> pushUrl
    const mappingRaw = process.env.FOLLOWER_PUSH_URLS || '{}';
    let mapping: Record<string,string> = {};
    try { mapping = JSON.parse(mappingRaw); } catch (e) { mapping = {}; }

    const pushed = readPushed();
    const masterTrades = await getMasterTrades();

    const newMasterTrades = masterTrades.filter(t => !pushed.has(t.id));
    if (newMasterTrades.length === 0) return NextResponse.json({ ok: true, message: 'no new master trades' });

    const db = await getDatabase();
    let totalSent = 0;
    
    for (const mt of newMasterTrades) {
      for (const follower of followerAccounts.filter(f => f.status === 'Active')) {
        // Respect explicit consent
        if (!follower.consentGiven) continue;

        // Check database copy_trading_active flag
        let copyTradingActive = true;
        try {
          if (db) {
            const results = await db.query(
              `SELECT copy_trading_active FROM follower_consents WHERE follower_id = ?`,
              [follower.id]
            ) as Array<any>;
            
            if (results && results.length > 0) {
              copyTradingActive = results[0].copy_trading_active !== 0 && results[0].copy_trading_active !== false;
            }
          }
        } catch (e: any) {
          console.warn(`[REPLICATE] Failed to check copy_trading_active for ${follower.id}:`, e.message);
          // Continue with default (true) if check fails
        }

        // Skip if copy trading is disabled for this follower
        if (!copyTradingActive) {
          console.log(`[REPLICATE] Skipping ${follower.id} - copy trading disabled`);
          continue;
        }

        const url = mapping[follower.id];

        // Scale quantity by lotMultiplier
        const scaledQty = Math.max(1, Math.floor((mt.quantity || 0) * (follower.lotMultiplier || 1)));

        // Enforce perAccountCap roughly by value
        const maxValue = follower.perAccountCap || Infinity;
        let qtyToSend = scaledQty;
        try {
          const value = (mt.price || 0) * qtyToSend;
          if (value > maxValue && mt.price > 0) {
            qtyToSend = Math.max(1, Math.floor(maxValue / mt.price));
          }
        } catch (e) {}

        const payloadTrade = {
          id: `${mt.id}-${follower.id}`,
          originalMasterId: mt.id,
          timestamp: mt.timestamp || new Date().toISOString(),
          symbol: mt.symbol,
          side: mt.side,
          qty: qtyToSend,
          price: mt.price,
          account: follower.id,
          type: mt.type,
        };

        try {
          if (url) {
            await postWithRetry(url, { accountId: follower.id, trades: [payloadTrade] }, { 'x-qa-secret': process.env.QUANTUM_ALPHA_SECRET || '' }, 2);
            totalSent++;
          } else {
            // Attempt direct order placement using stored follower credentials/session
            try {
              await pushOrderToAccount(follower.id, payloadTrade, { apiKey: follower.apiKey, clientId: follower.clientId, sessionToken: follower.sessionToken });
              totalSent++;
            } catch (e: any) {
              console.error('Direct push failed for follower', follower.id, e?.message ?? e);
            }
          }
        } catch (e: any) {
          console.error('Failed pushing to follower', follower.id, url ?? '(direct)', e?.message ?? e);
        }
      }

      // Mark master trade as pushed regardless (prevents reprocessing). If you prefer
      // per-follower tracking, change to store mapping of masterId -> [followerIds].
      pushed.add(mt.id);
    }

    writePushed(pushed);

    return NextResponse.json({ ok: true, sent: totalSent, masterTrades: newMasterTrades.length });
  } catch (err: any) {
    console.error('Replicate error', err);
    return NextResponse.json({ ok: false, message: err?.message ?? 'Unknown error' }, { status: 500 });
  }
}
