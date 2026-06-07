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
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
