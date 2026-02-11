import { Trade } from './data';
import crypto from 'crypto';
import fs from 'fs';

export type AliceTrade = Trade;

function extractArrayFromPayload(payload: any): any[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  // Common wrapper keys used by various AliceBlue endpoints
  const candidates = ['orders', 'trades', 'result', 'data'];
  for (const k of candidates) {
    if (payload[k] && Array.isArray(payload[k])) {
      try { console.debug(`[ALICE] extractArrayFromPayload: using key='${k}', items=${payload[k].length}`); } catch(e) {}
      return payload[k];
    }
  }
  return [];
}

function normalizeSide(o: any): 'Buy' | 'Sell' {
  const v = (o.Trantype || o.tranType || o.transactionType || o.side || o.buySell || '').toString().toUpperCase();
  if (v === 'S' || v === 'SELL' || v === 'SHORT') return 'Sell';
  return 'Buy';
}

/**
 * Parse various timestamp formats from Alice Blue API and convert to ISO 8601
 * Handles: ISO strings, Unix timestamps, HH:MM:SS format, etc.
 */
function parseTradeTimestamp(d: any, fallbackTime?: string): string {
  // Try each possible timestamp field in priority order
  // CRITICAL: Look for FillTime/ExchangeTimestamp first (actual trade execution)
  const candidates = [
    // Filled time (when trade was actually executed - MOST IMPORTANT)
    { key: 'FillTime', value: d.FillTime },
    { key: 'fillTime', value: d.fillTime },
    { key: 'FILL_TIME', value: d.FILL_TIME },
    
    // Exchange timestamp (from exchange, very accurate)
    { key: 'exchangeTimestamp', value: d.exchangeTimestamp },
    { key: 'ExchangeTimestamp', value: d.ExchangeTimestamp },
    { key: 'exchange_timestamp', value: d.exchange_timestamp },
    { key: 'Exch_Timestamp', value: d.Exch_Timestamp },
    
    // Traded time (actual execution)
    { key: 'TradedTime', value: d.TradedTime },
    { key: 'tradedTime', value: d.tradedTime },
    { key: 'Ttime', value: d.Ttime },
    
    // Order time fields
    { key: 'OrderTime', value: d.OrderTime },
    { key: 'orderTime', value: d.orderTime },
    { key: 'OrderCreateTime', value: d.OrderCreateTime },
    { key: 'CreatedTime', value: d.CreatedTime },
    { key: 'UpdatedTime', value: d.UpdatedTime },
    
    // Generic time/timestamp
    { key: 'time', value: d.time },
    { key: 'Time', value: d.Time },
    { key: 'timestamp', value: d.timestamp },
    { key: 'Timestamp', value: d.Timestamp },
    { key: 'tradeTime', value: d.tradeTime },
    { key: 'executionTime', value: d.executionTime },
  ];

  for (const candidate of candidates) {
    if (candidate.value === null || candidate.value === undefined || candidate.value === '') continue;
    
    const val = candidate.value.toString().trim();
    if (!val) continue;

    // *** CHECK FOR IST FORMAT FIRST (YYYY-MM-DD HH:MM:SS) ***
    // This MUST come before generic ISO 8601 parsing
    if (val.match(/^\d{4}-\d{2}-\d{2}\s\d{1,2}:\d{2}:\d{2}$/)) {
      try {
        // Parse as "YYYY-MM-DD HH:MM:SS" format (Alice Blue uses IST)
        // Example: "2026-02-11 16:17:22" is IST (UTC+5:30)
        const [datePart, timePart] = val.split(' ');
        const [yearStr, monthStr, dayStr] = datePart.split('-');
        const [hourStr, minStr, secStr] = timePart.split(':');
        
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);
        const day = parseInt(dayStr, 10);
        const hour = parseInt(hourStr, 10);
        const minute = parseInt(minStr, 10);
        const second = parseInt(secStr, 10);
        
        // Create a Date object in IST, then subtract 5:30 to get UTC
        const istDate = new Date(year, month - 1, day, hour, minute, second);
        const utcTime = new Date(istDate.getTime() - (5.5 * 60 * 60 * 1000));
        const isoString = utcTime.toISOString();
        console.debug(`[ALICE] parseTradeTimestamp: Using ${candidate.key}="${val}" (IST→UTC) → "${isoString}"`);
        return isoString;
      } catch (_) {
        console.warn(`[ALICE] Failed to parse ${candidate.key} as IST format: ${val}`);
      }
    }

    // Try to parse as ISO 8601 date string (with timezone)
    try {
      const date = new Date(val);
      if (!isNaN(date.getTime())) {
        const isoString = date.toISOString();
        console.debug(`[ALICE] parseTradeTimestamp: Using ${candidate.key}="${val}" → "${isoString}"`);
        return isoString;
      }
    } catch (_) {}

    // Try to parse as Unix timestamp (seconds or milliseconds)
    try {
      const num = Number(val);
      if (!isNaN(num) && num > 0) {
        // Detect if milliseconds or seconds based on magnitude
        const timeMs = num > 9999999999 ? num : num * 1000;
        const date = new Date(timeMs);
        if (!isNaN(date.getTime())) {
          const isoString = date.toISOString();
          console.debug(`[ALICE] parseTradeTimestamp: Using ${candidate.key}=${val} (unix) → "${isoString}"`);
          return isoString;
        }
      }
    } catch (_) {}

    // Try HH:MM:SS or HH:MM format (append today's date in IST and convert to UTC)
    if (val.match(/^\d{1,2}:\d{2}(?::\d{2})?$/)) {
      try {
        // Get today's date in UTC
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        
        const parts = val.split(':');
        const hour = parseInt(parts[0], 10);
        const minute = parseInt(parts[1], 10);
        const second = parseInt(parts[2] || '0', 10);
        
        // Create date with these time components (treating as IST)
        const istDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), hour, minute, second));
        
        // Subtract IST offset to convert to UTC
        const istOffsetMs = 5.5 * 60 * 60 * 1000;
        const utcDate = new Date(istDate.getTime() - istOffsetMs);
        
        if (!isNaN(utcDate.getTime())) {
          const isoString = utcDate.toISOString();
          console.debug(`[ALICE] parseTradeTimestamp: Using ${candidate.key}="${val}" (HH:MM:SS, IST→UTC) → "${isoString}"`);
          return isoString;
        }
      } catch (_) {}
    }
  }

  // Use fallback if provided (should be request fetch time)
  if (fallbackTime) {
    console.warn(`[ALICE] parseTradeTimestamp: No recognized field found, using fallback: "${fallbackTime}"`);
    return fallbackTime;
  }

  // Last resort: return epoch so it's obvious something is wrong
  console.warn(`[ALICE] parseTradeTimestamp: NO TIMESTAMP FOUND after checking ${candidates.length} fields! Using epoch (1970).`);
  console.warn(`[ALICE] Available fields in order object:`, Object.keys(d).filter(k => !k.includes('raw')).slice(0, 20));
  return new Date(0).toISOString();
}

async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 3, backoff = 500) {
  let attempt = 0;
  while (attempt <= retries) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      return res;
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, backoff * Math.pow(2, attempt)));
      attempt++;
    }
  }
  throw new Error('Unreachable');
}

export function buildAuthHeaders(apiKey: string, apiSecret: string, method: string | undefined, url: string, body?: string, bearerToken?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  // Bearer token takes precedence
  if (bearerToken) {
    headers['Authorization'] = `Bearer ${bearerToken}`;
    return headers;
  }

  const authMethod = (method || 'headers').toLowerCase();

  if (authMethod === 'basic') {
    headers['Authorization'] = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`;
  } else if (authMethod === 'hmac') {
    // Generic HMAC implementation: provider specifics may vary — adapt to Alice Blue docs as necessary
    const ts = Math.floor(Date.now() / 1000).toString();
    const urlObj = new URL(url);
    const path = urlObj.pathname + (urlObj.search || '');
    const payload = body ?? '';
    const toSign = `${ts}:${path}:${payload}`;
    const signature = crypto.createHmac('sha256', apiSecret).update(toSign).digest('hex');
    headers['x-api-key'] = apiKey;
    headers['x-timestamp'] = ts;
    headers['x-signature'] = signature;
  } else {
    // default: custom headers
    headers['x-api-key'] = apiKey;
    headers['x-api-secret'] = apiSecret;
  }

  return headers;
}

export async function getMasterTrades(): Promise<AliceTrade[]> {
  const endpoint = process.env.ALICE_TRADES_ENDPOINT || process.env.ALICE_API_BASE_URL;
  const apiKey = process.env.ALICE_API_KEY;
  const apiSecret = process.env.ALICE_API_SECRET;

  // If endpoint is missing, fall back to seeded master trades
  if (!endpoint) {
    const { trades } = await import('./data');
    return trades.filter(t => t.account === 'Master');
  }

  // Prefer OAuth token if available (env or token file)
  const tokenFromEnv = process.env.ALICE_OAUTH_TOKEN;
  const tokenFile = process.env.ALICE_OAUTH_TOKEN_FILE || '.alice.token';
  let token: string | undefined = tokenFromEnv;

  if (!token && fs.existsSync(tokenFile)) {
    try {
      token = fs.readFileSync(tokenFile, 'utf-8').trim();
    } catch (e) {
      console.warn('Failed reading token file', tokenFile, e);
    }
  }

  // If we don't have API key/secret and we also don't have a token, fallback
  if (!apiKey && !token) {
    const { trades } = await import('./data');
    return trades.filter(t => t.account === 'Master');
  }

  const authMethod = process.env.ALICE_AUTH_METHOD;
  const headers = buildAuthHeaders(apiKey ?? '', apiSecret ?? '', authMethod, endpoint, undefined, token);

  const res = await fetchWithRetry(endpoint, { headers });
  const payload = await res.json().catch(() => ({}));
  const source = extractArrayFromPayload(payload);

  const mapped: AliceTrade[] = (Array.isArray(source) ? source : [])
    .map((d: any, idx: number) => {
      const id = d.id ?? d.tradeId ?? d.NOrdNo ?? d.brokerOrderId ?? d.BrokerOrderId ?? d.orderId ?? undefined;
      const timestamp = parseTradeTimestamp(d);
      const symbol = d.symbol ?? d.instrument ?? d.scrip ?? d.ticker ?? '';
      const price = Number(d.price ?? d.rate ?? d.fillPrice ?? d.averageTradedPrice ?? d.avgTradedPrice ?? d.averagePrice ?? 0);
      const side = d.side ?? d.buySell ?? (d.transactionType === 'SELL' ? 'Sell' : 'Buy');
      // If no unique id, use composite key
      const uniqueId = id ?? `${symbol}_${timestamp}_${price}_${side}`;
      return {
        id: uniqueId,
        timestamp,
        account: process.env.ALICE_MASTER_ACCOUNT ?? 'Master',
        symbol,
        type: d.type ?? 'Market',
        side,
        quantity: Number(d.quantity ?? 0),
        price,
        status: d.status ?? 'Filled',
        // vendor-specific optional fields
        exchange: d.exchange ?? d.Exchange ?? '',
        tradingSymbol: d.tradingSymbol ?? d.Trsym ?? d.tradingSymbol ?? '',
        clientOrderId: d.clientOrderId ?? d.ClientOrderId ?? d.clientId ?? '',
        brokerOrderId: d.brokerOrderId ?? d.BrokerOrderId ?? d.NOrdNo ?? '',
        orderType: d.orderType ?? d.OrderType ?? '',
        orderStatus: d.orderStatus ?? d.orderStatus ?? d.status ?? '',
        filledQuantity: Number(d.quantity ?? 0),
        avgTradedPrice: Number(d.averageTradedPrice ?? d.avgTradedPrice ?? d.averagePrice ?? 0),
        exchangeTimestamp: d.exchangeTimestamp ?? d.orderTime ?? '',
        lotSize: Number(d.lotsize ?? d.lotSize ?? 0),
        product: d.product ?? '',
        raw: d,
      };
    });

  // Deduplicate by id
  const seen = new Set<string>();
  const deduped = mapped.filter(trade => {
    if (seen.has(trade.id)) return false;
    seen.add(trade.id);
    return true;
  });

  return deduped;
}

const TOKENS_FILE = process.env.ALICE_OAUTH_TOKENS_FILE || '.alice.tokens.json';

function readTokensFile(): Record<string, string> {
  const candidates = [TOKENS_FILE, '.alice.token'];
  for (const f of candidates) {
    try {
      if (!f) continue;
      if (fs.existsSync(f)) {
        const raw = fs.readFileSync(f, 'utf-8').trim();
        if (!raw) return {};

        // Try JSON first (expected mapping of accountId -> token)
        try {
          const parsed = JSON.parse(raw || '{}');
          if (parsed && typeof parsed === 'object') return parsed;
        } catch (_) {
          // Not JSON — treat file as a single token string and map to master account
          const key = process.env.ALICE_MASTER_ACCOUNT || 'Master';
          return { [key]: raw };
        }
      }
    } catch (e) {
      console.warn('Failed reading tokens file', f, e);
    }
  }

  return {};
}

function writeTokensFile(tokens: Record<string, string>) {
  try {
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2), { encoding: 'utf-8', flag: 'w' });
  } catch (e) {
    console.error('Failed writing tokens file', TOKENS_FILE, e);
  }
}

export function saveAccountToken(accountId: string, token: string) {
  if (!accountId) return;
  const tokens = readTokensFile();
  tokens[accountId] = token;
  writeTokensFile(tokens);
}

export function getAccountToken(accountId: string): string | undefined {
  if (!accountId) return undefined;
  const tokens = readTokensFile();
  return tokens[accountId];
}

export async function getTradesForAccount(accountId?: string): Promise<AliceTrade[]> {
  // Use the AliceBlue /orders/book endpoint for live trade book data (most reliable)
  const resolvedAccount = accountId || process.env.ALICE_MASTER_ACCOUNT || 'Master';
  const token = getAccountToken(resolvedAccount);

  if (!token) {
    console.error(`[ALICE] No OAuth token found for account ${resolvedAccount}. Returning empty trade list.`);
    return [];
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  try {
    // Try orders/book endpoint first (most reliable for getting completed trades)
    const ordersBookEndpoint = process.env.ALICE_ORDERS_BOOK_ENDPOINT || 'https://ant.aliceblueonline.com/open-api/od/v1/orders/book';
    const fetchStartTime = new Date().toISOString();
    
    console.log(`[ALICE] Fetching order book for ${resolvedAccount} via endpoint: ${ordersBookEndpoint}`);
    const res = await fetchWithRetry(ordersBookEndpoint, { headers });
    const payload = await res.json().catch(() => ({}));
    const orders = extractArrayFromPayload(payload);

    console.log(`[ALICE] Order book fetch for ${resolvedAccount}: received ${Array.isArray(orders) ? orders.length : 0} orders`);

    // Filter for completed/filled orders (these are the trades)
    const completedOrders = (Array.isArray(orders) ? orders : []).filter((o: any) => {
      const status = (o.Status || o.status || o.orderStatus || o.OrderStatus || '').toString().toLowerCase();
      return status === 'complete' || status === 'filled' || status === 'completed';
    });

    console.log(`[ALICE] Filtered to ${completedOrders.length} completed orders`);

    // Log first order structure to debug timestamp fields
    if (completedOrders.length > 0) {
      const firstOrder = completedOrders[0];
      const allFields = Object.keys(firstOrder).filter(k => k !== 'raw');
      const timeFields = allFields.filter(k => 
        k.toLowerCase().includes('time') || k.toLowerCase().includes('date')
      );
      
      console.log(`[ALICE] ✓ Found ${completedOrders.length} completed orders from orders/book endpoint`);
      console.log(`[ALICE] First order has these TIME-related fields:`, timeFields);
      console.log(`[ALICE] All fields in order object:`, allFields);
      
      // Show actual values of time fields
      const timeFieldValues: Record<string, any> = {};
      for (const field of timeFields) {
        timeFieldValues[field] = firstOrder[field];
      }
      console.log(`[ALICE] Time field values:`, timeFieldValues);
      
      // Show critical order details
      console.log(`[ALICE] First order details:`, {
        symbol: firstOrder.Trsym || firstOrder.symbol,
        qty: firstOrder.Qty || firstOrder.QtyFilled,
        status: firstOrder.Status || firstOrder.status,
        price: firstOrder.Prc || firstOrder.Price,
        side: firstOrder.Trantype || firstOrder.transactionType,
      });
    }

    const mapped: AliceTrade[] = completedOrders.map((o: any, idx: number) => {
      const tradeTime = parseTradeTimestamp(o, fetchStartTime);
      return {
        id: o.NOrdNo ?? o.orderId ?? o.BrokerOrderId ?? `A-ORD-${Date.now()}-${idx}`,
        timestamp: tradeTime,
        account: resolvedAccount,
        symbol: o.Trsym ?? o.symbol ?? o.instrument ?? o.tradingSymbol ?? '',
        type: o.OrderType ?? o.orderType ?? 'Market',
        side: normalizeSide(o),
        quantity: Number(o.quantity ?? 0),
        price: Number(o.Prc ?? o.Price ?? o.FillPrice ?? o.fillPrice ?? o.AvgPrice ?? o.averageTradedPrice ?? 0),
        status: 'Filled',
        exchange: o.Exch ?? o.exchange ?? '',
        tradingSymbol: o.Trsym ?? o.tradingSymbol ?? '',
        clientOrderId: o.clientOrderId ?? o.ClientOrderId ?? o.ClientId ?? '',
        brokerOrderId: o.NOrdNo ?? o.brokerOrderId ?? '',
        orderType: o.OrderType ?? o.orderType ?? '',
        orderStatus: o.orderStatus ?? o.Status ?? o.status ?? 'Filled',
        filledQuantity: Number(o.quantity ?? 0),
        avgTradedPrice: Number(o.AvgPrice ?? o.averageTradedPrice ?? o.Price ?? 0),
        exchangeTimestamp: o.exchangeTimestamp ?? o.orderTime ?? o.FillTime ?? o.fillTime ?? '',
        lotSize: Number(o.lotsize ?? o.lotSize ?? 0),
        product: o.product ?? o.Product ?? '',
        raw: o,
      };
    });

    if (mapped.length > 0) {
      console.log(`[ALICE] Successfully mapped ${mapped.length} trades from orders`);
      return mapped;
    }

    console.log(`[ALICE] Orders book returned 0 completed orders, no trades available`);
    return [];
  } catch (e) {
    console.error(`[ALICE] Order book endpoint failed for ${resolvedAccount}:`, e);
    
    // Fallback: try the trades endpoint if orders/book fails
    try {
      const tradesEndpoint = process.env.ALICE_OAUTH_TRADES_ENDPOINT || 'https://ant.aliceblueonline.com/open-api/od/v1/trades';
      console.log(`[ALICE] Falling back to trades endpoint for ${resolvedAccount}: ${tradesEndpoint}`);
      const res = await fetchWithRetry(tradesEndpoint, { headers });
      const payload = await res.json().catch(() => ({}));
      const trades = extractArrayFromPayload(payload);

      console.log(`[ALICE] Trades endpoint returned ${Array.isArray(trades) ? trades.length : 0} trades`);

      const mapped: AliceTrade[] = (Array.isArray(trades) ? trades : []).map((d: any, idx: number) => {

        const tradeTime = parseTradeTimestamp(d);
        return {
          id: d.id ?? d.tradeId ?? `A-${Date.now()}-${idx}`,
          timestamp: tradeTime,
          account: resolvedAccount,
          symbol: d.symbol ?? d.instrument ?? d.scrip ?? d.ticker ?? '',
          type: d.type ?? 'Market',
          side: d.side ?? d.buySell ?? (d.transactionType === 'SELL' ? 'Sell' : 'Buy'),
          quantity: Number(d.quantity ?? 0),
          price: Number(d.price ?? d.rate ?? d.fillPrice ?? d.averageTradedPrice ?? d.avgTradedPrice ?? 0),
          status: d.status ?? 'Filled',
          exchange: d.exchange ?? d.Exchange ?? '',
          tradingSymbol: d.tradingSymbol ?? d.Trsym ?? '',
          clientOrderId: d.clientOrderId ?? d.ClientOrderId ?? '',
          brokerOrderId: d.brokerOrderId ?? d.BrokerOrderId ?? d.NOrdNo ?? '',
          orderType: d.orderType ?? d.OrderType ?? '',
          orderStatus: d.orderStatus ?? d.Status ?? d.status ?? '',
          filledQuantity: Number(d.quantity ?? 0),
          avgTradedPrice: Number(d.averageTradedPrice ?? d.avgTradedPrice ?? 0),
          exchangeTimestamp: d.exchangeTimestamp ?? d.time ?? '',
          lotSize: Number(d.lotsize ?? d.lotSize ?? 0),
          product: d.product ?? '',
          raw: d,
        };
      });

      return mapped;
    } catch (e2) {
      console.error(`[ALICE] Trades fallback endpoint also failed for ${resolvedAccount}:`, e2);
      return [];
    }
  }
}

export async function pushOrderToAccount(accountId: string, order: any, follower?: { apiKey?: string; clientId?: string; sessionToken?: string }) {
  const orderEndpoint = process.env.ALICE_ORDER_ENDPOINT || (process.env.ALICE_API_BASE_URL ? `${process.env.ALICE_API_BASE_URL.replace(/\/$/, '')}/orders` : undefined);

  if (!orderEndpoint) {
    throw new Error('ALICE_ORDER_ENDPOINT not configured');
  }

  const token = follower?.sessionToken || getAccountToken(accountId);
  const apiKey = follower?.apiKey || process.env.ALICE_API_KEY || '';
  const apiSecret = follower?.clientId || process.env.ALICE_API_SECRET || '';
  const authMethod = process.env.ALICE_AUTH_METHOD;

  const headers = buildAuthHeaders(apiKey, apiSecret, authMethod, orderEndpoint, undefined, token);

  const body = {
    symbol: order.symbol,
    transactionType: (order.side || 'Buy').toString().toUpperCase() === 'SELL' ? 'SELL' : 'BUY',
    quantity: Number(order.qty || order.quantity || 0),
    orderType: (order.type || 'Market').toString().toUpperCase(),
    price: Number(order.price || 0),
    clientOrderId: order.id,
  };

  const res = await fetchWithRetry(orderEndpoint, { method: 'POST', headers, body: JSON.stringify(body) });
  const parsed = await res.json().catch(() => ({}));
  return parsed;
}

/**
 * Fetch order history / details for a single brokerOrderId and map to a trade-like object
 */
export async function getOrderHistory(brokerOrderId: string, accountId?: string): Promise<AliceTrade | null> {
  if (!brokerOrderId) return null;
  const resolvedAccount = accountId || process.env.ALICE_MASTER_ACCOUNT || 'Master';
  const token = getAccountToken(resolvedAccount);
  const endpoint = process.env.ALICE_ORDER_HISTORY_ENDPOINT || 'https://ant.aliceblueonline.com/open-api/od/v1/orders/history';

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const body = JSON.stringify({ brokerOrderId });
    const res = await fetchWithRetry(endpoint, { method: 'POST', headers, body });
    const payload = await res.json().catch(() => ({}));
    const result = Array.isArray(payload?.result) ? payload.result : (payload?.result ? [payload.result] : []);
    if (!result || result.length === 0) return null;
    const o = result[0];

    const filled = Number(o.filledQuantity ?? o.filledQty ?? o.filledQuantity ?? 0);
    const status = (o.orderStatus || o.orderStatus || o.status || '').toString().toLowerCase();

    if (filled === 0 && status !== 'complete' && status !== 'filled') return null;

    const trade: AliceTrade = {
      id: o.brokerOrderId || o.brokerOrderId || `${resolvedAccount}-${Date.now()}`,
      timestamp: parseTradeTimestamp(o),
      account: resolvedAccount,
      symbol: o.tradingSymbol || o.formattedInstrumentName || o.tradingSymbol || '',
      type: o.orderType || o.orderType || 'Market',
      side: (o.transactionType || 'BUY').toString().toUpperCase() === 'SELL' ? 'Sell' : 'Buy',
      quantity: Number(o.filledQuantity ?? o.filledQty ?? o.filledQuantity ?? filled ?? 0),
      price: Number(o.averageTradedPrice ?? o.averageTradedPrice ?? o.price ?? 0),
      status: o.orderStatus || o.orderStatus || (filled > 0 ? 'Filled' : 'Unknown'),
    };

    return trade;
  } catch (e) {
    console.error(`[ALICE] getOrderHistory failed for ${brokerOrderId}:`, e);
    return null;
  }
}
