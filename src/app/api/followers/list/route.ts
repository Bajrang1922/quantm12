import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

interface FollowerCredenials {
  followerId: string;
  loginUsername: string;
  loginPassword: string;
  createdAt: string;
  apiKey: string;
  apiSecret: string;
  clientId: string;
  lotMultiplier: number;
  maxQuantity?: number;
  maxDailyLoss?: number;
}

function getFollowerCredentialsPath() {
  return path.join(process.cwd(), '.alice.follower-credentials.json');
}

function loadFollowerCredentials(): FollowerCredenials[] {
  try {
    const filePath = getFollowerCredentialsPath();
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[FOLLOWERS] Error loading credentials:', error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('[FOLLOWERS] Fetching all followers');

    const credentials = loadFollowerCredentials();
    
    // Return followers with sensitive data masked/omitted
    const followers = credentials.map(cred => ({
      id: cred.followerId,
      username: cred.loginUsername,
      createdAt: cred.createdAt,
      lotMultiplier: cred.lotMultiplier,
      maxQuantity: cred.maxQuantity,
      maxDailyLoss: cred.maxDailyLoss,
    }));

    return NextResponse.json({
      ok: true,
      followers,
      total: followers.length,
    });
  } catch (error) {
    console.error('[FOLLOWERS] Error in GET:', error);
    return NextResponse.json({
      ok: false,
      error: 'Failed to fetch followers',
    }, { status: 500 });
  }
}
