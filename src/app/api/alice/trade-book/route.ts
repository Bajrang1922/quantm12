import { NextResponse, NextRequest } from 'next/server';
import { getAccountToken } from '@/lib/alice';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';

const MASTER_FILE = process.env.QUANTUM_MASTER_ACCOUNT_FILE || '.master.account';

/**
 * Fetch real-time Trade Book data from Alice Blue API
 * GET /api/alice/trade-book?accountId=<id>
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  let accountId = url.searchParams.get('accountId');

  try {
    // If no accountId provided, try to read the master account file
    if (!accountId) {
      try {
        const masterPath = path.join(process.cwd(), MASTER_FILE);
        if (fs.existsSync(masterPath)) {
          accountId = fs.readFileSync(masterPath, 'utf-8').trim();
          console.log('[TRADE-BOOK] Using master account from file:', accountId);
        }
      } catch (e) {
        console.warn('[TRADE-BOOK] Failed to read master account file:', e);
      }
    }

    const resolvedAccount = accountId || (process.env.ALICE_MASTER_ACCOUNT || 'Master');

    // Get the saved OAuth token for this account
    const token = getAccountToken(resolvedAccount);
    if (!token) {
      return NextResponse.json(
        { ok: false, message: 'No OAuth token found for this account' },
        { status: 401 }
      );
    }

    // Fetch Order Book from Alice Blue API (order-book is the primary source for fresh executions)
    const ordersEndpoint = process.env.ALICE_ORDERS_BOOK_ENDPOINT || 'https://ant.aliceblueonline.com/open-api/od/v1/orders/book';

    const fetchRes = await fetch(ordersEndpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!fetchRes.ok) {
      const errorBody = await fetchRes.text();
      console.error('Alice Blue Trade Book API error:', {
        status: fetchRes.status,
        body: errorBody,
      });
      return NextResponse.json(
        { ok: false, message: `Trade Book API returned ${fetchRes.status}`, details: errorBody },
        { status: fetchRes.status }
      );
    }

    const payload = await fetchRes.json();

    // Normalize using the order-book response and map completed orders to our trades format
    const orders = Array.isArray(payload?.orders) ? payload.orders : Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];

    const completed = (Array.isArray(orders) ? orders : []).filter((o: any) => (o.Status || o.status || '').toString().toLowerCase() === 'complete');

    const trades = completed.map((order: any, idx: number) => ({
      id: order.NOrdNo || order.orderId || `${resolvedAccount}-${Date.now()}-${idx}`,
      timestamp: order.FillTime || order.fillTime || order.createdAt || new Date().toISOString(),
      account: resolvedAccount,
      symbol: order.Trsym || order.symbol || order.instrument || '',
      type: order.OrderType || order.orderType || 'Market',
      side: (order.Trantype || order.tranType || order.transactionType || '').toString().toUpperCase() === 'B' || (order.Trantype || '').toString().toUpperCase() === 'BUY' ? 'Buy' : 'Sell',
      quantity: Number(order.Qty || order.qty || order.quantity || 0),
      tradedQty: Number(order.QtyFilled || order.filledQty || order.tradedQty || order.qty || 0),
      price: Number(order.Prc || order.Price || order.FillPrice || order.fillPrice || 0),
      status: 'Filled',
    }));

    return NextResponse.json({
      ok: true,
      trades,
      count: trades.length,
      source: 'alice-blue-order-book',
      accountId: resolvedAccount,
    });
  } catch (err: any) {
    console.error('Failed to fetch trade book:', err);
    return NextResponse.json(
      { ok: false, message: err?.message || 'Failed to fetch trade book' },
      { status: 500 }
    );
  }
}
