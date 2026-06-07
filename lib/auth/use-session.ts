'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/auth/supabase-browser';

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface SessionState {
  user: User | null;
  status: SessionStatus;
}

/**
 * Exposes the current auth session to client components.
 * Verifies identity via getUser() (contacts the auth server) and then keeps
 * in sync via onAuthStateChange. Returns { user, status }.
 */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({
    user: null,
    status: 'loading',
  });

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    // Guard: ignore auth-state-change events until getUser() has settled.
    // This prevents the INITIAL_SESSION event from causing a loading→unauthenticated
    // flicker before getUser() resolves as the authoritative initial check.
    let settled = false;

    supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (!active) return;
        settled = true;
        if (error || !data.user) {
          setState({ user: null, status: 'unauthenticated' });
        } else {
          setState({ user: data.user, status: 'authenticated' });
        }
      })
      .catch(() => {
        if (!active) return;
        settled = true;
        setState({ user: null, status: 'unauthenticated' });
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // Ignore events that arrive before getUser() settles.
      if (!settled) return;
      setState({
        user: session?.user ?? null,
        status: session?.user ? 'authenticated' : 'unauthenticated',
      });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
