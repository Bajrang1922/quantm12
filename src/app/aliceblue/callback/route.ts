import { NextResponse, NextRequest } from 'next/server';
import crypto from 'crypto';
import { saveAccountToken } from '@/lib/alice';
import fs from 'fs';
import path from 'path';

const MASTER_FILE = process.env.QUANTUM_MASTER_ACCOUNT_FILE || '.master.account';

function saveMasterAccountId(accountId: string) {
  try {
    const p = path.join(process.cwd(), MASTER_FILE);
    fs.writeFileSync(p, accountId, { encoding: 'utf-8', flag: 'w' });
    console.log('[OAUTH-CALLBACK] Saved master account:', accountId);
  } catch (e) {
    console.error('Failed saving master account id', e);
  }
}

/**
 * Vendor callback endpoint that Alice Blue calls after OAuth flow.
 * Alice Blue redirects to: /aliceblue/callback?authCode=...&userId=...&appcode=...
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const authCode = url.searchParams.get('authCode') || url.searchParams.get('authcode') || url.searchParams.get('code');
  const userId = url.searchParams.get('userId') || url.searchParams.get('userid') || url.searchParams.get('user');

  console.log('🔵 OAuth callback received:', { authCode: authCode ? '***masked***' : 'missing', userId });

  if (!authCode || !userId) {
    console.error('❌ Missing authCode or userId in callback', { authCode: !!authCode, userId });
    return NextResponse.json({ ok: false, message: 'Missing authCode or userId' }, { status: 400 });
  }

  const apiSecret = process.env.ALICE_API_SECRET;
  if (!apiSecret) {
    return NextResponse.json({ ok: false, message: 'ALICE_API_SECRET not configured' }, { status: 500 });
  }

  try {
    const checksum = crypto.createHash('sha256').update(String(userId) + String(authCode) + String(apiSecret)).digest('hex');

    const endpoint = 'https://ant.aliceblueonline.com/open-api/od/v1/vendor/getUserDetails';
    const fetchRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkSum: checksum }),
    });

    const payload = await fetchRes.json().catch(() => ({}));
    if (!fetchRes.ok) {
      return NextResponse.json({ ok: false, status: fetchRes.status, body: payload }, { status: 502 });
    }

    const userSession = payload?.userSession || payload?.userSessionToken || payload?.token || null;
    if (!userSession) {
      return NextResponse.json({ ok: false, message: 'No userSession in response', payload }, { status: 502 });
    }

    // Map token to the initiating accountId if present (set by /api/alice/oauth/start)
    try {
      const accountCookie = req.cookies.get('alice_oauth_account');
      const mappedAccountId = accountCookie?.value || String(userId);
      saveAccountToken(String(mappedAccountId), String(userSession));
      console.log('✅ Saved OAuth token for accountId:', mappedAccountId, '(vendorUserId:', userId, ')');
    } catch (e) {
      console.error('❌ Failed to save account token', e);
      return NextResponse.json({ ok: false, message: 'Failed to save token' }, { status: 500 });
    }

    // Check if this is a master account connection
    const isMasterConnection = req.cookies.get('alice_oauth_is_master')?.value === 'true';
    if (isMasterConnection) {
      saveMasterAccountId(String(userId));
    }

    // Create a user object and store in localStorage via redirect
    // Determine role based on whether this is a master account connection
    const userObj = {
      id: String(userId),
      role: isMasterConnection ? 'master' : 'trader',
      name: String(userId),
      authMethod: 'oauth'
    };

    console.log('✅ OAuth connection successful for:', { 
      userId,
      role: userObj.role,
      authMethod: 'oauth'
    });

    // Determine application origin: prefer explicit env var for correctness
    const appOrigin = process.env.ALICE_APP_ORIGIN || new URL(req.url).origin;
    const dashboardUrl = new URL('/dashboard', appOrigin);
    console.log('OAuth vendor callback:', { userId, dashboardUrl: dashboardUrl.toString() });
    const res = NextResponse.redirect(dashboardUrl.toString());

    // Store user in an HttpOnly cookie so the client can't tamper with it.
    // The client will call /api/auth/session to read the server-side cookie.
    res.cookies.set('alice_user', JSON.stringify(userObj), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24, // 24 hours
      sameSite: 'lax',
      path: '/',
    });

    return res;
  } catch (err: any) {
    console.error('Vendor callback error:', err);
    return NextResponse.json({ ok: false, message: err?.message ?? 'Unknown error' }, { status: 500 });
  }
}
