import { NextResponse, NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true, message: 'Logged out' });
  res.cookies.set('alice_user', '', { maxAge: 0, path: '/' });
  return res;
}
