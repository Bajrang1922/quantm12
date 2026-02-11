import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

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

export async function GET(request: NextRequest) {
  try {
    const followerId = request.nextUrl.searchParams.get('followerId');
    
    if (!followerId) {
      return NextResponse.json({
        ok: false,
        error: 'followerId is required',
      }, { status: 400 });
    }

    console.log(`[COPY-TRADES] Fetching copy trades for follower: ${followerId}`);

    const allTrades = loadCopyTrades();
    const followerTrades = allTrades
      .filter(trade => trade.followerId === followerId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    console.log(`[COPY-TRADES] Found ${followerTrades.length} trades for follower ${followerId}`);

    return NextResponse.json({
      ok: true,
      trades: followerTrades,
      total: followerTrades.length,
    });
  } catch (error) {
    console.error('[COPY-TRADES] Error in GET:', error);
    return NextResponse.json({
      ok: false,
      error: 'Failed to fetch copy trades',
    }, { status: 500 });
  }
}
