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

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const authCode = url.searchParams.get('authCode') || url.searchParams.get('authcode') || url.searchParams.get('code');
  const userId = url.searchParams.get('userId') || url.searchParams.get('userid') || url.searchParams.get('user');

  if (!authCode || !userId) {
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

    // Save session token keyed by userId (for master account only)
    try {
      saveAccountToken(String(userId), String(userSession));
    } catch (e) {
      console.error('Failed to save account token', e);
    }

    // Mark this account as the master account
    saveMasterAccountId(String(userId));
    const userObj = { id: String(userId), role: 'master', name: String(userId), authMethod: 'oauth' };

    console.log('✅ OAuth connection successful, marked as master account:', { userId });

    // Determine application origin: prefer explicit env var for correctness
    const appOrigin = process.env.ALICE_APP_ORIGIN || new URL(req.url).origin;
    const dashboardUrl = new URL('/dashboard', appOrigin);
    console.log('OAuth vendor callback:', { userId, dashboardUrl: dashboardUrl.toString() });
    const res = NextResponse.redirect(dashboardUrl.toString());
    
    // Store user in a cookie temporarily so the dashboard can set localStorage
    // (since this is an API route, we can't directly set localStorage)
    res.cookies.set('alice_user', JSON.stringify(userObj), {
      httpOnly: false,
      maxAge: 86400, // 24 hours
      sameSite: 'lax'
    });

    return res;
  } catch (err: any) {
    console.error('Vendor callback error:', err);
    return NextResponse.json({ ok: false, message: err?.message ?? 'Unknown error' }, { status: 500 });
  }
}
