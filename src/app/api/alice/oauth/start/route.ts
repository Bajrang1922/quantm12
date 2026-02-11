import { NextResponse, NextRequest } from 'next/server';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const CONFIG_FILE = process.env.ALICE_OAUTH_CONFIG_FILE || '.alice.oauth-config.json';

interface OAuthConfig {
  appCode?: string;
  clientId?: string;
  redirectUri?: string;
}

function readOAuthConfig(): OAuthConfig {
  try {
    const configPath = path.join(process.cwd(), CONFIG_FILE);
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8') || '{}');
    }
  } catch (e) {
    console.warn('Failed reading OAuth config:', e);
  }
  return {};
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const accountId = url.searchParams.get('accountId');
  const isMaster = url.searchParams.get('isMaster') === 'true';

  // Get config from env or file
  let clientId = process.env.ALICE_CLIENT_ID;
  let redirectUri = process.env.ALICE_REDIRECT_URI;
  let appCode = process.env.ALICE_APP_CODE;

  // Fallback to config file
  if (!clientId || !redirectUri || !appCode) {
    const fileConfig = readOAuthConfig();
    clientId = clientId || fileConfig.clientId;
    redirectUri = redirectUri || fileConfig.redirectUri;
    appCode = appCode || fileConfig.appCode;
  }

  if (!clientId && !appCode) {
    return NextResponse.json(
      {
        ok: false,
        message: 'OAuth credentials not configured. Please configure ALICE_CLIENT_ID and ALICE_REDIRECT_URI or update settings.'
      },
      { status: 400 }
    );
  }

  // Use appCode for OAuth flow (vendor app code)
  const authorizeUrl = process.env.ALICE_OAUTH_AUTHORIZE_ENDPOINT || 'https://ant.aliceblueonline.com/?appcode=';

  const state = crypto.randomBytes(16).toString('hex');

  // If we have appCode, use vendor app flow
  let redirectUrl: string;
  if (appCode) {
    redirectUrl = `${authorizeUrl}${encodeURIComponent(appCode)}`;
  } else {
    // Otherwise use standard OAuth flow
    const oauthUrl = new URL(authorizeUrl);
    oauthUrl.search = new URLSearchParams({
      response_type: 'code',
      client_id: clientId || '',
      redirect_uri: redirectUri || '',
      scope: 'trades',
      state,
    } as Record<string, string>).toString();
    redirectUrl = oauthUrl.toString();
  }

  console.log(`[OAUTH-START] OAuth flow for ${accountId} (master: ${isMaster})`);

  // Return JSON response instead of redirecting
  const res = NextResponse.json({
    ok: true,
    redirectUrl,
  });

  res.cookies.set('alice_oauth_state', state, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 300 });
  if (accountId) {
    res.cookies.set('alice_oauth_account', accountId, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 300 });
  }
  if (isMaster) {
    res.cookies.set('alice_oauth_is_master', 'true', { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 300 });
  }

  return res;
}
