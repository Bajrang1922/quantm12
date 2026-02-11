import { NextResponse, NextRequest } from 'next/server';
import crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { saveAccountToken } from '@/lib/alice';

interface FollowerCredentials {
  followerId: string;
  loginUsername: string;
  loginPassword: string;
  createdAt: string;
  apiKey: string;
  apiSecret: string;
  clientId: string;
  lotMultiplier: number;
  maxQuantity: number;
  maxOrderValue: number;
  maxDailyLoss: number;
  allowedInstruments: string[];
  allowedProductTypes: string[];
}

function getFollowerCredentialsPath() {
  return path.join(process.cwd(), '.alice.follower-credentials.json');
}

function loadFollowerCredentials(): FollowerCredentials[] {
  try {
    const filePath = getFollowerCredentialsPath();
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[FOLLOWER-REGISTER] Error loading credentials file:', error);
    return [];
  }
}

function saveFollowerCredentials(credentials: FollowerCredentials[]): void {
  try {
    const filePath = getFollowerCredentialsPath();
    fs.writeFileSync(filePath, JSON.stringify(credentials, null, 2), 'utf-8');
    console.log(`[FOLLOWER-REGISTER] Saved ${credentials.length} follower credentials`);
  } catch (error) {
    console.error('[FOLLOWER-REGISTER] Error saving credentials file:', error);
    throw error;
  }
}

/**
 * POST /api/followers/register-api-key
 * Master registers a follower with API credentials
 * System generates login username/password
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      followerName, 
      apiKey, 
      apiSecret, 
      clientId,
      lotMultiplier = 1,
      maxQuantity = 1000,
      maxOrderValue = 500000,
      maxDailyLoss = 50000,
      allowedInstruments = [],
      allowedProductTypes = ['MIS', 'CNC'],
    } = body;

    // Validate required fields
    if (!followerName || !apiKey || !apiSecret || !clientId) {
      return NextResponse.json(
        {
          ok: false,
          message: 'followerName, apiKey, apiSecret, and clientId are required'
        },
        { status: 400 }
      );
    }

    // Generate unique follower ID
    const followerId = `follower_${crypto.randomBytes(8).toString('hex')}`;
    
    // Generate login credentials
    const loginUsername = `${followerName.toLowerCase().replace(/\s+/g, '_')}_${crypto.randomBytes(4).toString('hex')}`;
    const loginPassword = crypto.randomBytes(16).toString('hex');

    // Save API credentials to token file (mapped by follower ID)
    saveAccountToken(followerId, apiKey);

    // Save follower credentials to persistent file
    const credentials = loadFollowerCredentials();
    credentials.push({
      followerId,
      loginUsername,
      loginPassword,
      createdAt: new Date().toISOString(),
      apiKey,
      apiSecret,
      clientId,
      lotMultiplier,
      maxQuantity,
      maxOrderValue,
      maxDailyLoss,
      allowedInstruments,
      allowedProductTypes,
    });
    saveFollowerCredentials(credentials);

    console.log(`[FOLLOWER-REGISTER] New follower registered: ${followerId}`);
    console.log(`[FOLLOWER-REGISTER] Login username: ${loginUsername}`);

    // Return credentials (only shown once!)
    return NextResponse.json({
      ok: true,
      message: 'Follower registered successfully',
      follower: {
        followerId,
        followerName,
        loginUsername,
        loginPassword,
        createdAt: new Date().toISOString(),
      },
      credentials: {
        apiKey: `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`,
        clientId: `${clientId.substring(0, 4)}...${clientId.substring(clientId.length - 4)}`,
      },
      riskConfig: {
        lotMultiplier,
        maxQuantity,
        maxOrderValue,
        maxDailyLoss,
        allowedInstruments,
        allowedProductTypes,
      },
    });
  } catch (error: any) {
    console.error('[FOLLOWER-REGISTER] Error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message ?? 'Unknown error' },
      { status: 500 }
    );
  }
}
