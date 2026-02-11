import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';

interface CopyTrade {
  id: string;
  masterId: string;
  followerId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  masterQty: number;
  followerQty: number;
  price: number;
  status: 'SUCCESS' | 'PENDING' | 'FAILED' | 'CANCELLED';
  timestamp: string;
  reason?: string;
}

function getCopyTradesFilePath() {
  return path.join(process.cwd(), '.alice.copy-trades.json');
}

function loadCopyTrades(): CopyTrade[] {
  try {
    const filePath = getCopyTradesFilePath();
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[COPY-TRADES] Error loading copy trades:', error);
    return [];
  }
}

function saveCopyTrades(trades: CopyTrade[]): void {
  try {
    const filePath = getCopyTradesFilePath();
    fs.writeFileSync(filePath, JSON.stringify(trades, null, 2), 'utf-8');
  } catch (error) {
    console.error('[COPY-TRADES] Error saving copy trades:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      masterId,
      followerId,
      symbol,
      side,
      masterQty,
      followerQty,
      price,
      status = 'PENDING',
      reason,
    } = body;

    // Validate required fields
    if (!masterId || !followerId || !symbol || !side || masterQty === undefined || followerQty === undefined || price === undefined) {
      return NextResponse.json({
        ok: false,
        error: 'Missing required fields',
      }, { status: 400 });
    }

    console.log(`[COPY-TRADES] Creating copy trade: ${symbol} ${side} qty=${followerQty} for follower=${followerId}`);

    const newTrade: CopyTrade = {
      id: `trade_${crypto.randomBytes(6).toString('hex')}`,
      masterId,
      followerId,
      symbol,
      side: side.toUpperCase() as 'BUY' | 'SELL',
      masterQty,
      followerQty,
      price,
      status: status.toUpperCase() as 'SUCCESS' | 'PENDING' | 'FAILED' | 'CANCELLED',
      timestamp: new Date().toISOString(),
      reason,
    };

    const trades = loadCopyTrades();
    trades.push(newTrade);
    saveCopyTrades(trades);

    console.log(`[COPY-TRADES] Copy trade created: ${newTrade.id}`);

    return NextResponse.json({
      ok: true,
      trade: newTrade,
    });
  } catch (error) {
    console.error('[COPY-TRADES] Error in POST:', error);
    return NextResponse.json({
      ok: false,
      error: 'Failed to create copy trade',
    }, { status: 500 });
  }
}

// Update copy trade status
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    const { tradeId, status, reason } = body;

    if (!tradeId || !status) {
      return NextResponse.json({
        ok: false,
        error: 'Missing required fields: tradeId, status',
      }, { status: 400 });
    }

    console.log(`[COPY-TRADES] Updating trade ${tradeId} to status=${status}`);

    const trades = loadCopyTrades();
    const trade = trades.find(t => t.id === tradeId);

    if (!trade) {
      return NextResponse.json({
        ok: false,
        error: 'Trade not found',
      }, { status: 404 });
    }

    trade.status = status.toUpperCase() as 'SUCCESS' | 'PENDING' | 'FAILED' | 'CANCELLED';
    if (reason) {
      trade.reason = reason;
    }

    saveCopyTrades(trades);

    console.log(`[COPY-TRADES] Trade ${tradeId} updated to status=${trade.status}`);

    return NextResponse.json({
      ok: true,
      trade,
    });
  } catch (error) {
    console.error('[COPY-TRADES] Error in PATCH:', error);
    return NextResponse.json({
      ok: false,
      error: 'Failed to update copy trade',
    }, { status: 500 });
  }
}
