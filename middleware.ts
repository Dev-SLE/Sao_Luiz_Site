import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/** Mesmo nome que `SESSION_COOKIE_NAME` em `lib/server/session.ts` (evita import Node no Edge). */
const SESSION_COOKIE_NAME = 'sle_session';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname === '/manifest.webmanifest' ||
    pathname.startsWith('/icon') ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  if (pathname === '/login' || pathname === '/recuperar-senha' || pathname === '/redefinir-senha') {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(SESSION_COOKIE_NAME);
  if (!cookie?.value || cookie.value.length < 8) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === '/colaborador') {
    const url = request.nextUrl.clone();
    url.pathname = '/perfil';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
