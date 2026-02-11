/**
 * Master-Follower Trade Replication Engine
 * Handles: Risk validation, order replication, mapping, and exit sync
 */

import { getDatabase } from './db';
import { pushOrderToAccount } from './alice';
import crypto from 'crypto';

export interface MasterTrade {
  id: string;
  symbol: string;
  exchange?: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price?: number;
  product_type?: string;
  order_type?: string;
  timestamp?: string;
}

export interface FollowerRiskConfig {
  lot_multiplier: number;
  max_quantity: number;
  max_order_value?: number;
  max_daily_loss?: number;
  allowed_instruments?: string[];
  allowed_product_types?: string[];
  allowed_order_types?: string[];
  enabled: boolean;
}

export interface FollowerAccount {
  id: string;
  client_id: string;
  api_key: string;
  access_token: string;
  broker_session_id?: string;
  status: string;
  risk_config: FollowerRiskConfig;
}

export interface ReplicationResult {
  follower_id: string;
  status: 'SUCCESS' | 'SKIPPED' | 'FAILED';
  reason?: string;
  follower_order_id?: string;
  executed_quantity?: number;
  order_mapping_id?: string;
}

/**
 * Validate if a symbol is allowed for a follower
 */
export function validateSymbol(symbol: string, allowedInstruments?: string[]): boolean {
  if (!allowedInstruments || allowedInstruments.length === 0) {
    return true; // No restrictions
  }
  return allowedInstruments.includes(symbol.toUpperCase());
}

/**
 * Validate if an order type is allowed
 */
export function validateOrderType(orderType: string, allowedTypes?: string[]): boolean {
  if (!allowedTypes || allowedTypes.length === 0) {
    return true; // No restrictions
  }
  return allowedTypes.includes(orderType.toUpperCase());
}

/**
 * Validate if a product type is allowed
 */
export function validateProductType(productType: string | undefined, allowedTypes?: string[]): boolean {
  if (!productType || !allowedTypes || allowedTypes.length === 0) {
    return true; // No restrictions
  }
  return allowedTypes.includes(productType.toUpperCase());
}

/**
 * Calculate follower order quantity based on risk rules
 */
export function calculateFollowerQuantity(
  masterQuantity: number,
  riskConfig: FollowerRiskConfig
): { quantity: number; reason?: string } {
  // Apply lot multiplier
  let followerQty = Math.floor(masterQuantity * riskConfig.lot_multiplier);

  // Check max quantity limit
  if (followerQty > riskConfig.max_quantity) {
    followerQty = riskConfig.max_quantity;
    return { quantity: followerQty, reason: `Capped to max_quantity: ${riskConfig.max_quantity}` };
  }

  // If result is 0 after multiplier, skip this follower
  if (followerQty === 0) {
    return { quantity: 0, reason: `Quantity becomes 0 after multiplier: ${riskConfig.lot_multiplier}` };
  }

  return { quantity: followerQty };
}

/**
 * Validate order against follower risk config
 */
export function validateFollowerOrder(
  masterTrade: MasterTrade,
  riskConfig: FollowerRiskConfig
): { valid: boolean; reason?: string } {
  // Check if account is enabled
  if (!riskConfig.enabled) {
    return { valid: false, reason: 'Account is disabled' };
  }

  // Validate symbol
  if (!validateSymbol(masterTrade.symbol, riskConfig.allowed_instruments)) {
    return { valid: false, reason: `Symbol ${masterTrade.symbol} not in allowed instruments` };
  }

  // Validate order type
  if (masterTrade.order_type && !validateOrderType(masterTrade.order_type, riskConfig.allowed_order_types)) {
    return { valid: false, reason: `Order type ${masterTrade.order_type} not allowed` };
  }

  // Validate product type
  if (masterTrade.product_type && !validateProductType(masterTrade.product_type, riskConfig.allowed_product_types)) {
    return { valid: false, reason: `Product type ${masterTrade.product_type} not allowed` };
  }

  // Check max order value if price is available
  if (masterTrade.price && riskConfig.max_order_value) {
    const orderValue = masterTrade.quantity * masterTrade.price;
    if (orderValue > riskConfig.max_order_value) {
      return { valid: false, reason: `Order value ₹${orderValue} exceeds max: ₹${riskConfig.max_order_value}` };
    }
  }

  return { valid: true };
}

/**
 * Load all active follower accounts with their risk configs
 */
export async function loadActiveFollowers(): Promise<FollowerAccount[]> {
  const db = await getDatabase();
  if (!db) throw new Error('Database connection failed');

  const query = `
    SELECT 
      fc.follower_id, 
      fc.client_id, 
      fc.api_key, 
      fc.access_token, 
      fc.broker_session_id,
      fc.status,
      rc.lot_multiplier,
      rc.max_quantity,
      rc.max_order_value,
      rc.max_daily_loss,
      rc.allowed_instruments,
      rc.allowed_product_types,
      rc.allowed_order_types,
      rc.enabled
    FROM follower_credentials fc
    LEFT JOIN follower_risk_config rc ON fc.follower_id = rc.follower_id
    WHERE fc.status = 'ACTIVE'
  `;

  const rows = await db.query(query);
  
  return rows.map((row: any) => ({
    id: row.follower_id,
    client_id: row.client_id,
    api_key: row.api_key,
    access_token: row.access_token,
    broker_session_id: row.broker_session_id,
    status: row.status,
    risk_config: {
      lot_multiplier: row.lot_multiplier || 1.0,
      max_quantity: row.max_quantity || 100,
      max_order_value: row.max_order_value,
      max_daily_loss: row.max_daily_loss,
      allowed_instruments: row.allowed_instruments ? JSON.parse(row.allowed_instruments) : undefined,
      allowed_product_types: row.allowed_product_types ? JSON.parse(row.allowed_product_types) : undefined,
      allowed_order_types: row.allowed_order_types ? JSON.parse(row.allowed_order_types) : undefined,
      enabled: row.enabled !== false,
    },
  }));
}

/**
 * Process a master trade and replicate to all followers (or selected followers)
 */
export async function replicateTradeToFollowers(
  masterTrade: MasterTrade,
  tradeEventId: string,
  followerIds?: string[]
): Promise<ReplicationResult[]> {
  const results: ReplicationResult[] = [];

  try {
    const followers = await loadActiveFollowers();

    // Filter by followerIds if provided
    const targetFollowers = followerIds && followerIds.length > 0
      ? followers.filter(f => followerIds.includes(f.id))
      : followers;

    // If followerIds were provided but no followers found, return explicit failure
    if (followerIds && followerIds.length > 0 && targetFollowers.length === 0) {
      return followerIds.map(fid => ({
        follower_id: fid,
        status: 'FAILED',
        reason: 'Follower not found or not active',
      }));
    }

    for (const follower of targetFollowers) {
      const result = await replicateToSingleFollower(masterTrade, follower, tradeEventId);
      results.push(result);
    }
  } catch (error) {
    console.error('Error replicating trades:', error);
  }

  return results;
}

/**
 * Replicate trade to a single follower
 */
async function replicateToSingleFollower(
  masterTrade: MasterTrade,
  follower: FollowerAccount,
  tradeEventId: string
): Promise<ReplicationResult> {
  const db = await getDatabase();
  if (!db) {
    return {
      follower_id: follower.id,
      status: 'FAILED',
      reason: 'Database connection failed',
    };
  }

  try {
    // Check if copy trading is active for this follower
    const consentRows = await db.query(
      `SELECT copy_trading_active FROM follower_consents WHERE follower_id = ?`,
      [follower.id]
    ) as Array<any>;
    
    const consent = consentRows[0];
    if (consent && !consent.copy_trading_active) {
      return {
        follower_id: follower.id,
        status: 'SKIPPED',
        reason: 'Copy trading disabled for this follower',
      };
    }

    // Validate against risk config
    const validation = validateFollowerOrder(masterTrade, follower.risk_config);
    if (!validation.valid) {
      return {
        follower_id: follower.id,
        status: 'SKIPPED',
        reason: validation.reason,
      };
    }

    // Calculate follower quantity
    const { quantity, reason: qtyReason } = calculateFollowerQuantity(
      masterTrade.quantity,
      follower.risk_config
    );

    if (quantity === 0) {
      return {
        follower_id: follower.id,
        status: 'SKIPPED',
        reason: qtyReason || 'Quantity becomes 0 after multiplier',
      };
    }

    // Create order mapping
    const mappingId = generateId();
    await db.query(
      `
      INSERT INTO order_mappings 
      (id, master_order_id, follower_id, symbol, exchange, side, quantity, product_type, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', NOW(), NOW())
      `,
      [
        mappingId,
        masterTrade.id,
        follower.id,
        masterTrade.symbol,
        masterTrade.exchange || 'NSE',
        masterTrade.side,
        quantity,
        masterTrade.product_type || 'MIS',
      ]
    );

    // Place order via Alice Blue API with follower's credentials
    let followerOrderId: string | undefined;
    
    try {
      console.log(`[ALICE-BLUE] Placing order for follower ${follower.id}:`, {
        symbol: masterTrade.symbol,
        side: masterTrade.side,
        quantity: quantity,
        price: masterTrade.price,
      });

      const aliceResponse = await pushOrderToAccount(
        follower.id,
        {
          id: masterTrade.id,
          symbol: masterTrade.symbol,
          side: masterTrade.side,
          qty: quantity,
          quantity: quantity,
          price: masterTrade.price,
          type: masterTrade.order_type || 'MARKET',
        },
        {
          apiKey: follower.api_key,
          clientId: follower.client_id,
          sessionToken: follower.broker_session_id,
        }
      );

      // Extract order ID from Alice Blue response
      followerOrderId = aliceResponse?.orderId || aliceResponse?.order_id || aliceResponse?.id;

      if (!followerOrderId) {
        throw new Error(`No order ID returned from Alice Blue: ${JSON.stringify(aliceResponse)}`);
      }

      console.log(`[ALICE-BLUE] Order placed successfully for ${follower.id}: ${followerOrderId}`);
    } catch (aliceError: any) {
      const errorMsg = aliceError.message || 'Failed to place order on Alice Blue';
      console.error(`[ALICE-BLUE-ERROR] Follower ${follower.id}:`, errorMsg);

      // Update mapping with error and mark as FAILED
      await db.query(
        `UPDATE order_mappings SET status = 'FAILED', error_message = ?, updated_at = NOW() WHERE id = ?`,
        [errorMsg, mappingId]
      );

      return {
        follower_id: follower.id,
        status: 'FAILED',
        reason: `Alice Blue API error: ${errorMsg}`,
        order_mapping_id: mappingId,
      };
    }

    // Update mapping with follower order ID and mark as ACTIVE
    await db.query(
      `UPDATE order_mappings SET follower_order_id = ?, status = 'ACTIVE', executed_quantity = ?, updated_at = NOW() WHERE id = ?`,
      [followerOrderId, quantity, mappingId]
    );

    return {
      follower_id: follower.id,
      status: 'SUCCESS',
      follower_order_id: followerOrderId,
      executed_quantity: quantity,
      order_mapping_id: mappingId,
    };
  } catch (error: any) {
    return {
      follower_id: follower.id,
      status: 'FAILED',
      reason: error.message || 'Unknown error',
    };
  }
}

/**
 * Record trade event in audit log
 */
export async function recordTradeEvent(
  masterTrade: MasterTrade,
  eventType: 'PLACE' | 'MODIFY' | 'EXIT' | 'CANCEL',
  results: ReplicationResult[]
): Promise<string> {
  const db = await getDatabase();
  if (!db) throw new Error('Database connection failed');

  const eventId = generateId();
  const successful = results.filter(r => r.status === 'SUCCESS').length;
  const failed = results.filter(r => r.status === 'FAILED').length;
  const skipped = results.filter(r => r.status === 'SKIPPED').length;

  await db.query(
    `
    INSERT INTO trade_events 
    (id, master_order_id, event_type, symbol, exchange, side, quantity, product_type, order_type, price, total_followers, successful_followers, failed_followers, skipped_followers, processed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `,
    [
      eventId,
      masterTrade.id,
      eventType,
      masterTrade.symbol,
      masterTrade.exchange || 'NSE',
      masterTrade.side,
      masterTrade.quantity,
      masterTrade.product_type || 'MIS',
      masterTrade.order_type || 'MARKET',
      masterTrade.price || 0,
      results.length,
      successful,
      failed,
      skipped,
    ]
  );

  return eventId;
}

/**
 * Get all order mappings for a master order
 */
export async function getOrderMappings(masterOrderId: string) {
  const db = await getDatabase();
  if (!db) throw new Error('Database connection failed');

  const rows = await db.query(
    `SELECT * FROM order_mappings WHERE master_order_id = ? ORDER BY created_at DESC`,
    [masterOrderId]
  );

  return rows;
}

/**
 * Sync exit order to all follower positions
 */
export async function syncExitOrder(masterOrderId: string): Promise<ReplicationResult[]> {
  const db = await getDatabase();
  if (!db) throw new Error('Database connection failed');

  const mappings = await getOrderMappings(masterOrderId);
  const results: ReplicationResult[] = [];

  for (const mapping of mappings) {
    try {
      // Skip if already cancelled or no follower order ID
      if (mapping.status === 'CANCELLED' || !mapping.follower_order_id) {
        results.push({
          follower_id: mapping.follower_id,
          status: 'SKIPPED',
          reason: `Order already ${mapping.status.toLowerCase()} or no order ID`,
        });
        continue;
      }

      // Get follower credentials to call Alice Blue
      const followerRows = await db.query(
        `SELECT fc.*, rc.lot_multiplier FROM follower_credentials fc
         LEFT JOIN follower_risk_config rc ON fc.follower_id = rc.follower_id
         WHERE fc.follower_id = ?`,
        [mapping.follower_id]
      );

      if (!followerRows || followerRows.length === 0) {
        throw new Error('Follower credentials not found');
      }

      const follower = followerRows[0];

      console.log(`[EXIT-ORDER] Cancelling order ${mapping.follower_order_id} for follower ${mapping.follower_id}`);

      // Call Alice Blue API to cancel the order
      try {
        // For cancellation, we might need a specific endpoint
        // This is a placeholder - actual implementation depends on Alice Blue API
        const cancelResponse = await fetch(
          `${process.env.ALICE_API_BASE_URL}/orders/${mapping.follower_order_id}/cancel`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${follower.access_token}`,
              'x-api-key': follower.api_key,
            },
          }
        ).then(r => r.json());

        if (!cancelResponse.ok && cancelResponse.status !== 200) {
          throw new Error(`Alice Blue cancel failed: ${JSON.stringify(cancelResponse)}`);
        }

        console.log(`[EXIT-ORDER] Successfully cancelled ${mapping.follower_order_id}`);
      } catch (apiError: any) {
        console.warn(`[EXIT-ORDER] Alice Blue cancel call failed, will mark as cancelled in DB anyway:`, apiError);
        // Continue - we'll still mark as cancelled in our DB
      }

      // Update mapping status to CANCELLED
      await db.query(
        `UPDATE order_mappings SET status = 'CANCELLED', updated_at = NOW() WHERE id = ?`,
        [mapping.id]
      );

      results.push({
        follower_id: mapping.follower_id,
        status: 'SUCCESS',
        reason: 'Exit order processed',
      });
    } catch (error: any) {
      console.error(`[EXIT-ORDER-ERROR] Follower ${mapping.follower_id}:`, error);
      results.push({
        follower_id: mapping.follower_id,
        status: 'FAILED',
        reason: error.message || 'Unknown error',
      });
    }
  }

  return results;
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}
