import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// Mock the browser client BEFORE importing the hook.
const getUser = vi.fn();
const onAuthStateChange = vi.fn();
const unsubscribe = vi.fn();
vi.mock('@/lib/auth/supabase-browser', () => ({
  createClient: () => ({
    auth: { getUser, onAuthStateChange },
  }),
}));

import { useSession } from '@/lib/auth/use-session';

beforeEach(() => {
  vi.clearAllMocks();
  onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe } },
  });
});

describe('useSession', () => {
  it('starts loading then resolves to authenticated with the user', async () => {
    getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.com' } },
      error: null,
    });
    const { result } = renderHook(() => useSession());
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(result.current.user?.email).toBe('a@b.com');
  });

  it('resolves to unauthenticated when there is no user', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    expect(result.current.user).toBeNull();
  });

  it('unsubscribes on unmount', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const { result, unmount } = renderHook(() => useSession());
    // Wait for initial getUser() to settle before unmounting to avoid racy cleanup.
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    act(() => unmount());
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('resolves to unauthenticated when getUser() returns an error', async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: new Error('network error'),
    });
    const { result } = renderHook(() => useSession());
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    expect(result.current.user).toBeNull();
  });

  it('resolves to unauthenticated when getUser() rejects', async () => {
    getUser.mockRejectedValue(new Error('fetch failed'));
    const { result } = renderHook(() => useSession());
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    expect(result.current.user).toBeNull();
  });

  it('transitions to authenticated via onAuthStateChange after getUser settles', async () => {
    let capturedCallback: ((event: string, session: unknown) => void) | null = null;
    onAuthStateChange.mockImplementation((cb: (event: string, session: unknown) => void) => {
      capturedCallback = cb;
      return { data: { subscription: { unsubscribe } } };
    });
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    const { result } = renderHook(() => useSession());
    // Wait for initial getUser() to settle (unauthenticated — no user).
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

    // Now fire onAuthStateChange with a new session.
    await act(async () => {
      capturedCallback!('SIGNED_IN', { user: { id: 'u2', email: 'c@d.com' } });
    });

    expect(result.current.status).toBe('authenticated');
    expect(result.current.user?.email).toBe('c@d.com');
  });

  it('transitions to unauthenticated via onAuthStateChange after sign-out', async () => {
    let capturedCallback: ((event: string, session: unknown) => void) | null = null;
    onAuthStateChange.mockImplementation((cb: (event: string, session: unknown) => void) => {
      capturedCallback = cb;
      return { data: { subscription: { unsubscribe } } };
    });
    getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.com' } },
      error: null,
    });

    const { result } = renderHook(() => useSession());
    // Wait for initial getUser() to settle (authenticated).
    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    // Fire sign-out event.
    await act(async () => {
      capturedCallback!('SIGNED_OUT', null);
    });

    expect(result.current.status).toBe('unauthenticated');
    expect(result.current.user).toBeNull();
  });
});
