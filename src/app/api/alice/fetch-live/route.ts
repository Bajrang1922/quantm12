import { NextResponse, NextRequest } from 'next/server';
import fs from 'fs';

const INCOMING_FILE = process.env.QUANTUM_ALPHA_INCOMING_FILE || '.alice.incoming.json';

async function fetchFromAliceBlue(token: string, accountId: string): Promise<any[]> {
  console.log(`[FETCH-LIVE] Fetching trades for account ${accountId}...`);

  try {
    // Try the trades endpoint first
    const url = 'https://ant.aliceblueonline.com/open-api/od/v1/trades';
    
    console.log(`[FETCH-LIVE] Calling: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`[FETCH-LIVE] Response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[FETCH-LIVE] API Error:`, {
        status: response.status,
        message: errorText.substring(0, 200),
      });
      throw new Error(`API returned ${response.status}: ${errorText.substring(0, 100)}`);
    }

    const data = await response.json();
    console.log(`[FETCH-LIVE] Response structure:`, {
      type: typeof data,
      isArray: Array.isArray(data),
      keys: Array.isArray(data) ? [] : Object.keys(data),
      count: Array.isArray(data) ? data.length : data?.length || data?.data?.length || 0,
    });

    // Handle different response formats
    let trades: any[] = [];
    if (Array.isArray(data)) {
      trades = data;
    } else if (data?.trades && Array.isArray(data.trades)) {
      trades = data.trades;
    } else if (data?.data && Array.isArray(data.data)) {
      trades = data.data;
    }

    console.log(`[FETCH-LIVE] Extracted ${trades.length} trades`);
    return trades;
  } catch (err: any) {
    console.error(`[FETCH-LIVE] Error:`, err?.message);
    throw err;
  }
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-qa-secret');
  const expectedSecret = process.env.QUANTUM_ALPHA_SECRET || 'testsecret';

  if (secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const accountId = body.accountId || '2548613';
    const token = body.token || process.env.ALICE_OAUTH_TOKEN;

    if (!token) {
      return NextResponse.json(
        {
          error: 'No OAuth token provided',
          hint: 'Pass token in body or set ALICE_OAUTH_TOKEN env var',
          usage: 'POST /api/alice/fetch-live with {"token":"...", "accountId":"..."}',
        },
        { status: 400 }
      );
    }

    console.log(`[FETCH-LIVE] Starting fetch for account ${accountId}`);
    const trades = await fetchFromAliceBlue(token, accountId);

    if (trades.length === 0) {
      return NextResponse.json({
        message: 'No trades found (account may be empty or token invalid)',
        trades: [],
        accountId,
      });
    }

    // Normalize the trades
    const normalized = trades.map((trade: any, idx: number) => {
      // Handle NIFTY 10th FEB 25950 PE format
      const symbol = trade.exchTokenInfo || trade.symbol || trade.instrument || '';
      
      return {
        id: trade.id || trade.tradeId || `${accountId}-${Date.now()}-${idx}`,
        timestamp: trade.orderDate || trade.time || trade.createdAt || new Date().toISOString(),
        account: accountId,
        symbol,
        type: trade.product || trade.productType || trade.type || 'CNC',
        side: (trade.transactionType || trade.buySell || trade.side || 'Buy').toUpperCase(),
        quantity: Number(trade.quantity || trade.qty || 0),
        tradedQty: Number(trade.orderFilledQuantity || trade.filledQty || trade.quantity || 0),
        price: Number(trade.filledPrice || trade.price || 0),
        status: trade.orderStatus || trade.status || 'filled',
        product: trade.product || 'CNC',
        orderDate: trade.orderDate,
        orderTime: trade.orderTime,
      };
    });

    console.log(`[FETCH-LIVE] Normalized ${normalized.length} trades`);

    // Cache the trades
    try {
      const existing = fs.existsSync(INCOMING_FILE)
        ? JSON.parse(fs.readFileSync(INCOMING_FILE, 'utf-8'))
        : {};
      existing[accountId] = normalized;
      fs.writeFileSync(INCOMING_FILE, JSON.stringify(existing, null, 2));
      console.log(`[FETCH-LIVE] Cached ${normalized.length} trades`);
    } catch (cacheErr) {
      console.warn('[FETCH-LIVE] Failed to cache trades:', cacheErr);
    }

    return NextResponse.json({
      ok: true,
      message: `Fetched and cached ${normalized.length} trades from Alice Blue`,
      accountId,
      tradeCount: normalized.length,
      recentTrades: normalized.slice(-3),
      cacheFile: INCOMING_FILE,
    });
  } catch (error: any) {
    console.error('[FETCH-LIVE] Error:', error);
    return NextResponse.json(
      {
        error: error?.message || 'Unknown error',
        hint: 'Check token validity and network connection',
      },
      { status: 500 }
    );
  }
}

// GET to fetch without caching (read-only)
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-qa-secret');
  const expectedSecret = process.env.QUANTUM_ALPHA_SECRET || 'testsecret';

  if (secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get('token') || process.env.ALICE_OAUTH_TOKEN;
  const accountId = url.searchParams.get('accountId') || '2548613';

  if (!token) {
    return NextResponse.json(
      { error: 'No token provided. Use ?token=... or set ALICE_OAUTH_TOKEN' },
      { status: 400 }
    );
  }

  try {
    const trades = await fetchFromAliceBlue(token, accountId);
    return NextResponse.json({
      ok: true,
      trades,
      count: trades.length,
      cached: false,
      message: 'Returned directly from Alice Blue (not cached)',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch' },
      { status: 500 }
    );
  }
}
