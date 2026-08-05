import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session';

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login|api/auth/login|api/auth/logout).*)'],
};

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySessionToken(token)) {
    return NextResponse.next();
  }

  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const loginUrl = new URL('/login', req.url);
  return NextResponse.redirect(loginUrl);
}
