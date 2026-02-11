/**
 * Copy Trading Engine
 * Handles replication of master trades to followers with risk management
 */

interface Follower {
  id: string;
  name: string;
  apiKey: string;
  clientId: string;
  lotMultiplier: number;
  maxQuantity?: number;
  maxDailyLoss?: number;
}

interface TradeReplicationConfig {
  symbol: string;
  side: 'BUY' | 'SELL';
  masterQty: number;
  price: number;
  masterId: string;
}

/**
 * Calculate follower quantity based on lot multiplier
 */
export function calculateFollowerQuantity(
  masterQty: number,
  lotMultiplier: number,
  maxQuantity?: number
): number {
  let followerQty = Math.floor(masterQty * lotMultiplier);

  // Apply max quantity constraint
  if (maxQuantity && followerQty > maxQuantity) {
    followerQty = maxQuantity;
  }

  return Math.max(1, followerQty); // Ensure at least 1
}

/**
 * Log a copy trade for a follower
 */
export async function logCopyTrade(config: {
  masterId: string;
  followerId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  masterQty: number;
  followerQty: number;
  price: number;
  status?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  reason?: string;
}): Promise<void> {
  try {
    console.log('[COPY-TRADE-LOG] Logging copy trade:', {
      symbol: config.symbol,
      side: config.side,
      follower: config.followerId,
      qty: config.followerQty,
    });

    const response = await fetch('/api/followers/copy-trades-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      console.error('[COPY-TRADE-LOG] Error logging copy trade:', response.statusText);
    } else {
      const result = await response.json();
      console.log('[COPY-TRADE-LOG] Copy trade logged with ID:', result.trade?.id);
    }
  } catch (error) {
    console.error('[COPY-TRADE-LOG] Exception logging copy trade:', error);
  }
}

/**
 * Replicate a trade to all followers
 */
export async function replicateTradeToFollowers(config: {
  masterId: string;
  followers: Follower[];
  symbol: string;
  side: 'BUY' | 'SELL';
  masterQty: number;
  price: number;
}): Promise<void> {
  console.log(`[COPY-TRADE-REPLICATE] Replicating ${config.symbol} ${config.side} to ${config.followers.length} followers`);

  for (const follower of config.followers) {
    const followerQty = calculateFollowerQuantity(
      config.masterQty,
      follower.lotMultiplier,
      follower.maxQuantity
    );

    // Log the copy trade
    await logCopyTrade({
      masterId: config.masterId,
      followerId: follower.id,
      symbol: config.symbol,
      side: config.side,
      masterQty: config.masterQty,
      followerQty,
      price: config.price,
      status: 'PENDING',
    });
  }
}

/**
 * Update copy trade status (e.g., from PENDING to SUCCESS)
 */
export async function updateCopyTradeStatus(
  tradeId: string,
  status: 'SUCCESS' | 'FAILED' | 'CANCELLED',
  reason?: string
): Promise<void> {
  try {
    console.log(`[COPY-TRADE-STATUS] Updating trade ${tradeId} to ${status}`);

    const response = await fetch('/api/followers/copy-trades-log', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tradeId, status, reason }),
    });

    if (!response.ok) {
      console.error('[COPY-TRADE-STATUS] Error updating trade status:', response.statusText);
    }
  } catch (error) {
    console.error('[COPY-TRADE-STATUS] Exception updating trade status:', error);
  }
}
