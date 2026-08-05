import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword } from '@/lib/auth';
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from '@/lib/session';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const username = typeof body?.username === 'string' ? body.username : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  const expectedUsername = process.env.AUTH_USERNAME;
  const passwordHash = process.env.AUTH_PASSWORD_HASH;
  if (!expectedUsername || !passwordHash) {
    return NextResponse.json({ error: 'Login não configurado.' }, { status: 500 });
  }

  if (username !== expectedUsername || !verifyPassword(password, passwordHash)) {
    return NextResponse.json({ error: 'Usuário ou senha inválidos.' }, { status: 401 });
  }

  const token = await createSessionToken(username);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}
