import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser Supabase client (singleton-friendly: call per-component, the lib
 * dedupes internally). Uses only the publishable key — safe to ship to the
 * client. Never import the secret key here.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
