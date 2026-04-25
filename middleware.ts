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

  if (pathname === '/app/patrimonio' || pathname === '/app/patrimonio/') {
    const url = request.nextUrl.clone();
    url.pathname = '/app/patrimonio/ativos';
    return NextResponse.redirect(url);
  }

  /** BI financeiro: rota canônica no Gerencial (compat com bookmarks `/app/financeiro/...`). */
  if (pathname === '/app/financeiro' || pathname.startsWith('/app/financeiro/')) {
    const url = request.nextUrl.clone();
    url.pathname = '/app/gerencial/financeiro/bi-inicial';
    return NextResponse.redirect(url);
  }

  /** Gerencial BI: primeiro segmento após `/app/gerencial` deve ser setor; senão, injeta `comercial`. */
  if (pathname.startsWith('/app/gerencial/')) {
    const rest = pathname.slice('/app/gerencial/'.length).replace(/\/+$/, '');
    const first = rest.split('/')[0]?.toLowerCase() ?? '';
    if (first && first !== 'comercial' && first !== 'financeiro' && first !== 'operacao') {
      const url = request.nextUrl.clone();
      url.pathname = `/app/gerencial/comercial/${rest}`;
      url.search = request.nextUrl.search;
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
