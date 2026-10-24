import { type NextRequest, NextResponse } from 'next/server';
import { serverApiUrl } from '@/lib/api-url';

async function proxy(request: NextRequest, path: readonly string[]): Promise<Response> {
  const target = new URL(`/auth/${path.join('/')}`, serverApiUrl());
  target.search = request.nextUrl.search;
  const headers = new Headers();
  const cookie = request.headers.get('cookie');
  if (cookie) {
    headers.set('cookie', cookie);
  }
  const contentType = request.headers.get('content-type');
  if (contentType) {
    headers.set('content-type', contentType);
  }
  headers.set('x-forwarded-host', request.headers.get('host') ?? '');
  headers.set('x-forwarded-proto', request.nextUrl.protocol.replace(':', ''));

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: 'manual',
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }

  const upstream = await fetch(target, init);
  const response = new NextResponse(upstream.body, { status: upstream.status });
  const location = upstream.headers.get('location');
  if (location) {
    response.headers.set('location', location);
  }
  for (const cookieValue of upstream.headers.getSetCookie()) {
    response.headers.append('set-cookie', cookieValue);
  }
  return response;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await context.params;
  return proxy(request, path);
}
