/**
 * POST /api/followers/execute-copy-trade
 * Execute a copy trade using follower's Client ID + API Key
 * Prevents duplicate trades - same trade won't be copied twice to same follower
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { pushOrderToAccount } from '@/lib/alice';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      masterId = 'master_account',
      followerId,
      listenerFollowers,
      symbol,
      side,
      masterQty,
      price,
      productType = 'MIS',
      orderType = 'REGULAR',
      tradeId, // Master trade ID to prevent duplicates
    } = body;

    if (!symbol || !side || !masterQty || !price) {
      return NextResponse.json(
        { ok: false, message: 'Missing required trade fields: symbol, side, masterQty, price' },
        { status: 400 }
      );
    }

    if (!tradeId) {
      return NextResponse.json(
        { ok: false, message: 'Missing tradeId - required to prevent duplicate copies' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    if (!db) {
      return NextResponse.json(
        { ok: false, message: 'Database connection failed' },
        { status: 500 }
      );
    }

    // Get followers to trade to
    let followers: any[] = [];
    
    if (followerId) {
      // Trade to specific follower
      const result = await db.query(`
        SELECT 
          f.id,
          f.follower_name,
          fc.client_id,
          fc.api_key,
          fc.lot_multiplier,
          fc.max_order_quantity,
          fc.copy_trading_enabled
        FROM followers f
        LEFT JOIN follower_credentials fc ON f.id = fc.follower_id
        WHERE f.id = ? AND fc.copy_trading_enabled = true
      `, [followerId]) as any[];
      
      followers = result || [];
    } else if (listenerFollowers && Array.isArray(listenerFollowers)) {
      // Trade to all specified followers
      const result = await db.query(`
        SELECT 
          f.id,
          f.follower_name,
          fc.client_id,
          fc.api_key,
          fc.lot_multiplier,
          fc.max_order_quantity,
          fc.copy_trading_enabled
        FROM followers f
        LEFT JOIN follower_credentials fc ON f.id = fc.follower_id
        WHERE f.id IN (?) AND fc.copy_trading_enabled = true
      `, [listenerFollowers]) as any[];
      
      followers = result || [];
    } else {
      // Trade to all active followers for this master
      const result = await db.query(`
        SELECT 
          f.id,
          f.follower_name,
          fc.client_id,
          fc.api_key,
          fc.lot_multiplier,
          fc.max_order_quantity,
          fc.copy_trading_enabled
        FROM followers f
        LEFT JOIN follower_credentials fc ON f.id = fc.follower_id
        WHERE f.status = 'active' AND fc.copy_trading_enabled = true
      `) as any[];
      
      followers = result || [];
    }

    if (followers.length === 0) {
      return NextResponse.json(
        { ok: false, message: 'No active followers found for copy trading' },
        { status: 400 }
      );
    }

    const results = [];
    const copyTradeId = `copytrade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const totalFollowers = followers.length;
    let successCount = 0;
    let skippedDuplicateCount = 0;
    let failedCount = 0;

    // Execute copy trade to each follower
    for (const follower of followers) {
      try {
        // Check if this trade has already been copied to this follower
        const existingCopy = await db.query(`
          SELECT id FROM copied_trade_history
          WHERE master_trade_id = ? AND follower_id = ?
        `, [tradeId, follower.id]) as any[];

        if (existingCopy && existingCopy.length > 0) {
          // Already copied this trade to this follower - SKIP IT
          results.push({
            followerId: follower.id,
            followerName: follower.follower_name,
            status: 'SKIPPED',
            reason: 'Trade already copied to this follower (duplicate prevention)',
          });
          skippedDuplicateCount++;
          console.log(`[COPY-TRADE] Skipping duplicate: ${tradeId} to ${follower.id}`);
          continue;
        }

        // Calculate follower quantity based on lot multiplier
        const lotMultiplier = follower.lot_multiplier || 1;
        const maxQty = follower.max_order_quantity || 1000;
        let followerQty = Math.floor(masterQty * lotMultiplier);
        
        if (followerQty > maxQty) {
          followerQty = maxQty;
        }

        if (followerQty === 0) {
          results.push({
            followerId: follower.id,
            followerName: follower.follower_name,
            status: 'SKIPPED',
            reason: 'Quantity too small after multiplier',
          });
          skippedDuplicateCount++;
          continue;
        }

        // Push order to Alice Blue using Client ID + API Key
        const orderResponse = await pushOrderToAccount(symbol, {
          symbol,
          side: side.toUpperCase(),
          quantity: followerQty,
          price,
          productType,
          orderType,
        }, {
          apiKey: follower.api_key,
          clientId: follower.client_id,
        });

        if (orderResponse?.ok || orderResponse?.order_id) {
          // Record this copy to prevent future duplicates
          await db.query(`
            INSERT INTO copied_trade_history 
            (master_trade_id, follower_id, symbol, side, master_qty, follower_qty, price, copied_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
          `, [
            tradeId,
            follower.id,
            symbol.toUpperCase(),
            side.toUpperCase(),
            masterQty,
            followerQty,
            price,
          ]);

          // Log successful copy trade
          await db.query(`
            INSERT INTO copy_trades 
            (id, master_id, follower_id, symbol, side, master_qty, follower_qty, price, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SUCCESS', NOW())
          `, [
            `${copyTradeId}_${follower.id}`,
            masterId,
            follower.id,
            symbol.toUpperCase(),
            side.toUpperCase(),
            masterQty,
            followerQty,
            price,
          ]);

          results.push({
            followerId: follower.id,
            followerName: follower.follower_name,
            status: 'SUCCESS',
            followerQty,
            orderId: orderResponse.order_id,
          });
          successCount++;
          console.log(`[COPY-TRADE] Success: ${tradeId} to ${follower.follower_name} (qty: ${followerQty})`);
        } else {
          // Log failed copy trade
          await db.query(`
            INSERT INTO copy_trades 
            (id, master_id, follower_id, symbol, side, master_qty, follower_qty, price, status, reason, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'FAILED', ?, NOW())
          `, [
            `${copyTradeId}_${follower.id}`,
            masterId,
            follower.id,
            symbol.toUpperCase(),
            side.toUpperCase(),
            masterQty,
            0,
            price,
            orderResponse?.error || 'Failed to push order',
          ]);

          results.push({
            followerId: follower.id,
            followerName: follower.follower_name,
            status: 'FAILED',
            reason: orderResponse?.error || 'Failed to push order',
          });
          failedCount++;
          console.error(`[COPY-TRADE] Failed: ${tradeId} to ${follower.follower_name} - ${orderResponse?.error}`);
        }
      } catch (followerError: any) {
        console.error(`[COPY-TRADE] Error trading with follower ${follower.id}:`, followerError);
        
        // Log failed copy trade
        await db.query(`
          INSERT INTO copy_trades 
          (id, master_id, follower_id, symbol, side, master_qty, follower_qty, price, status, reason, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'FAILED', ?, NOW())
        `, [
          `${copyTradeId}_${follower.id}`,
          masterId,
          follower.id,
          symbol.toUpperCase(),
          side.toUpperCase(),
          masterQty,
          0,
          price,
          followerError.message,
        ]);

        results.push({
          followerId: follower.id,
          followerName: follower.follower_name,
          status: 'FAILED',
          reason: followerError.message,
        });
        failedCount++;
      }
    }

    console.log(`[COPY-TRADE] Summary for ${symbol} ${side}: ${successCount} success, ${skippedDuplicateCount} skipped (duplicate), ${failedCount} failed, out of ${totalFollowers} followers`);

    return NextResponse.json({
      ok: true,
      copyTradeId,
      masterTradeId: tradeId,
      message: `Copy trade executed: ${successCount} successful, ${skippedDuplicateCount} skipped (already copied), ${failedCount} failed`,
      results,
      summary: { 
        successCount, 
        failedCount, 
        skippedDuplicateCount,
        totalFollowers 
      },
    });
  } catch (error: any) {
    console.error('[COPY-TRADE] Error:', error);
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 500 }
    );
  }
}
