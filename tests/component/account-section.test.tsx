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
});
