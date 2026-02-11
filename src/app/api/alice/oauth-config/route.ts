import { NextResponse, NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

const CONFIG_FILE = process.env.ALICE_OAUTH_CONFIG_FILE || '.alice.oauth-config.json';

interface OAuthConfig {
  appCode?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  authMethod?: string;
  configured: boolean;
  lastUpdated?: string;
}

function readConfig(): OAuthConfig {
  try {
    const configPath = path.join(process.cwd(), CONFIG_FILE);
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(content || '{}');
      return {
        ...parsed,
        configured: !!(parsed.appCode || parsed.clientId),
      };
    }
  } catch (e) {
    console.error('Failed reading OAuth config:', e);
  }

  return {
    configured: false,
  };
}

function writeConfig(config: OAuthConfig) {
  try {
    const configPath = path.join(process.cwd(), CONFIG_FILE);
    fs.writeFileSync(
      configPath,
      JSON.stringify(
        {
          appCode: config.appCode || undefined,
          clientId: config.clientId || undefined,
          clientSecret: config.clientSecret || undefined,
          redirectUri: config.redirectUri || undefined,
          authMethod: config.authMethod || 'headers',
          lastUpdated: new Date().toISOString(),
        },
        null,
        2
      ),
      { encoding: 'utf-8', flag: 'w' }
    );
    console.log('[OAUTH-CONFIG] Configuration saved');
  } catch (e) {
    console.error('Failed writing OAuth config:', e);
    throw e;
  }
}

/**
 * GET /api/alice/oauth-config
 * Retrieve current OAuth configuration (masked secrets)
 */
export async function GET() {
  try {
    const config = readConfig();

    // Mask sensitive values
    const maskedConfig = {
      ...config,
      clientSecret: config.clientSecret ? `${config.clientSecret.substring(0, 4)}...${config.clientSecret.substring(config.clientSecret.length - 4)}` : undefined,
      appCode: config.appCode ? `${config.appCode.substring(0, 4)}...${config.appCode.substring(config.appCode.length - 4)}` : undefined,
    };

    return NextResponse.json({
      ok: true,
      config: maskedConfig,
    });
  } catch (error: any) {
    console.error('[OAUTH-CONFIG] Error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message ?? 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/alice/oauth-config
 * Update OAuth configuration
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { appCode, clientId, clientSecret, redirectUri, authMethod } = body;

    // Validate at least one credential
    if (!appCode && !clientId) {
      return NextResponse.json(
        { ok: false, message: 'At least appCode or clientId is required' },
        { status: 400 }
      );
    }

    const currentConfig = readConfig();

    // Update config (preserve old secrets if not provided)
    const newConfig: OAuthConfig = {
      appCode: appCode || currentConfig.appCode,
      clientId: clientId || currentConfig.clientId,
      clientSecret: clientSecret || currentConfig.clientSecret,
      redirectUri: redirectUri || currentConfig.redirectUri,
      authMethod: authMethod || currentConfig.authMethod || 'headers',
      configured: true,
      lastUpdated: new Date().toISOString(),
    };

    writeConfig(newConfig);

    // Also set environment variables
    if (newConfig.appCode) process.env.ALICE_APP_CODE = newConfig.appCode;
    if (newConfig.clientId) process.env.ALICE_CLIENT_ID = newConfig.clientId;
    if (newConfig.clientSecret) process.env.ALICE_CLIENT_SECRET = newConfig.clientSecret;
    if (newConfig.redirectUri) process.env.ALICE_REDIRECT_URI = newConfig.redirectUri;
    if (newConfig.authMethod) process.env.ALICE_AUTH_METHOD = newConfig.authMethod;

    console.log('[OAUTH-CONFIG] Configuration updated successfully');

    return NextResponse.json({
      ok: true,
      message: 'Configuration updated',
      config: newConfig,
    });
  } catch (error: any) {
    console.error('[OAUTH-CONFIG] POST Error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message ?? 'Unknown error' },
      { status: 500 }
    );
  }
}
