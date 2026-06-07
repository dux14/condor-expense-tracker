import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import esMessages from '@/messages/es.json';

const signInWithOAuth = vi.fn();
vi.mock('@/lib/auth/supabase-browser', () => ({
  createClient: () => ({ auth: { signInWithOAuth } }),
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

import { toast } from 'sonner';
import LoginScreen from '@/components/auth/LoginScreen';

function withIntl(ui: React.ReactElement) {
  return (
    <NextIntlClientProvider locale="es" messages={esMessages}>
      {ui}
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  signInWithOAuth.mockResolvedValue({ data: {}, error: null });
  // jsdom: default online
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});

afterEach(() => {
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});

describe('LoginScreen', () => {
  it('renders the Google sign-in button and tagline', () => {
    render(withIntl(<LoginScreen />));
    expect(
      screen.getByRole('button', { name: /Continuar con Google/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Lo ve todo desde arriba/i)).toBeInTheDocument();
  });

  it('calls signInWithOAuth with provider google and the callback redirect', async () => {
    render(withIntl(<LoginScreen />));
    await userEvent.click(
      screen.getByRole('button', { name: /Continuar con Google/i }),
    );
    expect(signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'google',
        options: expect.objectContaining({
          redirectTo: expect.stringContaining('/auth/callback'),
        }),
      }),
    );
  });

  it('shows an offline notice and disables the button when offline', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    render(withIntl(<LoginScreen />));
    expect(screen.getByText(/Sin conexión/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Continuar con Google/i }),
    ).toBeDisabled();
  });

  it('shows a toast error and re-enables the button when OAuth fails', async () => {
    signInWithOAuth.mockResolvedValue({ data: {}, error: new Error('boom') });
    render(withIntl(<LoginScreen />));
    const button = screen.getByRole('button', { name: /Continuar con Google/i });
    await userEvent.click(button);
    expect(toast.error).toHaveBeenCalled();
    expect(button).not.toBeDisabled();
  });
});
