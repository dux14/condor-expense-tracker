import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import esMessages from '@/messages/es.json';

const signOut = vi.fn();
const replace = vi.fn();
vi.mock('@/lib/auth/supabase-browser', () => ({
  createClient: () => ({ auth: { signOut } }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@/lib/auth/use-session', () => ({
  useSession: () => ({
    status: 'authenticated',
    user: {
      id: 'u1',
      email: 'samu@example.com',
      user_metadata: { full_name: 'Samu', avatar_url: 'https://x/a.png' },
    },
  }),
}));

import { AccountSection } from '@/components/settings/AccountSection';

function withIntl(ui: React.ReactElement) {
  return (
    <NextIntlClientProvider locale="es" messages={esMessages}>
      {ui}
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  signOut.mockResolvedValue({ error: null });
});

describe('AccountSection', () => {
  it('shows the signed-in user email', () => {
    render(withIntl(<AccountSection />));
    expect(screen.getByText('samu@example.com')).toBeInTheDocument();
  });

  it('signs out and redirects to /login', async () => {
    render(withIntl(<AccountSection />));
    await userEvent.click(screen.getByRole('button', { name: /Cerrar sesión/i }));
    expect(signOut).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith('/login');
  });

  it('ignores a second click while sign-out is in progress', async () => {
    // Keep signOut pending so busy stays true after the first click
    let resolvePending!: () => void;
    signOut.mockReturnValueOnce(
      new Promise<{ error: null }>((resolve) => {
        resolvePending = () => resolve({ error: null });
      }),
    );

    render(withIntl(<AccountSection />));
    const btn = screen.getByRole('button', { name: /Cerrar sesión/i });

    // First click starts the in-flight sign-out
    await userEvent.click(btn);
    // Second click should be swallowed by the `if (busy) return` guard
    await userEvent.click(btn);

    expect(signOut).toHaveBeenCalledTimes(1);

    // Clean up: resolve the promise so the component can unmount cleanly
    resolvePending();
  });
});
