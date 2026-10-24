import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'codepilot_session';

export function middleware(request: NextRequest): NextResponse {
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (session) {
    return NextResponse.next();
  }

  const login = new URL('/login', request.url);
  login.searchParams.set('next', request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    '/dashboard',
    '/dashboard/:path*',
    '/documents',
    '/documents/:path*',
    '/evaluation',
    '/evaluation/:path*',
    '/repositories',
    '/repositories/:path*',
    '/tasks',
    '/tasks/:path*',
    '/settings',
    '/settings/:path*',
  ],
};
