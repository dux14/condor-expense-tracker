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
    const { unmount } = renderHook(() => useSession());
    await waitFor(() => expect(onAuthStateChange).toHaveBeenCalled());
    act(() => unmount());
    expect(unsubscribe).toHaveBeenCalled();
  });
});
