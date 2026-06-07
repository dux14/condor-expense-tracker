import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/auth/middleware-session';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image
     * - favicon.ico, icons, manifest, service worker, brand assets
     * - common image/font extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icon.png|apple-icon.png|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
};
