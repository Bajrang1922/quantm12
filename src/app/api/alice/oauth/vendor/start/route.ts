import { NextResponse, NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const appKey = process.env.ALICE_CLIENT_ID;
  if (!appKey) {
    return NextResponse.json({ ok: false, message: 'ALICE_CLIENT_ID (App Key) not configured' }, { status: 500 });
  }

  const redirectUrl = `https://ant.aliceblueonline.com/?appcode=${encodeURIComponent(appKey)}`;

  const res = NextResponse.redirect(redirectUrl);
  
  // Set a cookie to indicate this is a master account OAuth flow
  res.cookies.set('alice_oauth_is_master', 'true', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 5, // 5 minutes - short lived since we expect immediate redirect
    sameSite: 'lax',
    path: '/',
  });

  return res;
}

