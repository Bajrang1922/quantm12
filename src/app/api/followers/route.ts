/**
 * GET /api/followers
 * List all followers and their status
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    // TODO: Add authentication check
    // const user = await authenticateUser(req);

    // Return followers from database
    return NextResponse.json({
      ok: true,
      followers: [
        // Placeholder - will be populated from database
      ],
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // TODO: Add authentication check
    const body = await req.json();
    const { followerId, clientId, apiKey, accessToken, riskConfig } = body;

    if (!followerId || !clientId || !apiKey || !accessToken) {
      return NextResponse.json(
        { ok: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // TODO: Validate credentials with Alice Blue
    // TODO: Create follower credential record in database
    // TODO: Create follower risk config record

    return NextResponse.json({
      ok: true,
      message: 'Follower added successfully',
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 500 }
    );
  }
}
