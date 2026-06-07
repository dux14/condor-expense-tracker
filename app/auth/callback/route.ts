import { NextResponse } from 'next/server';
import { createClient } from '@/lib/auth/supabase-server';

/**
 * OAuth callback. Supabase redirects here with ?code=... after Google login.
 * We exchange the code for a session (cookies written via the SSR client),
 * then send the user to the app. On error, back to /login.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  // Sanitize `next`: only accept same-origin paths.
  // Construct via new URL(rawNext, origin) and assert the origin matches to
  // prevent open-redirect attacks (e.g. ?next=@evil.com or ?next=//evil.com).
  const rawNext = searchParams.get('next');
  let next = '/';
  if (rawNext) {
    try {
      const resolved = new URL(rawNext, origin);
      if (resolved.origin === origin) {
        next = resolved.pathname + resolved.search + resolved.hash;
      }
    } catch {
      // malformed URL → fall back to '/'
    }
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
