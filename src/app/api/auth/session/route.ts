import { NextResponse, NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const cookie = req.cookies.get('alice_user');
    if (!cookie) {
      return NextResponse.json({ ok: false, message: 'No session' }, { status: 401 });
    }
    const userJson = cookie.value;
    try {
      const user = JSON.parse(userJson);
      return NextResponse.json({ ok: true, user });
    } catch (e) {
      console.error('Failed to parse session cookie', e);
      return NextResponse.json({ ok: false, message: 'Invalid session' }, { status: 500 });
    }
  } catch (err: any) {
    console.error('Session route error', err);
    return NextResponse.json({ ok: false, message: err?.message || 'Session error' }, { status: 500 });
  }
}
