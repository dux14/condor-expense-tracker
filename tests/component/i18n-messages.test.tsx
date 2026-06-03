import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { useTranslations } from 'next-intl';
import { getMessages } from '@/lib/i18n/messages';

// A tiny component that renders the keys we want to assert on.
function I18nChild() {
  const t = useTranslations('Common');
  return (
    <div>
      <span data-testid="app-name">{t('appName')}</span>
      <span data-testid="tagline">{t('tagline')}</span>
    </div>
  );
}

describe('i18n messages wiring', () => {
  it('renders Spanish messages correctly', () => {
    render(
      <NextIntlClientProvider
        locale="es"
        messages={getMessages('es')}
        timeZone="America/Bogota"
      >
        <I18nChild />
      </NextIntlClientProvider>,
    );

    expect(screen.getByTestId('app-name')).toHaveTextContent('Cóndor');
    expect(screen.getByTestId('tagline')).toHaveTextContent(
      'Lo ve todo desde arriba.',
    );
  });

  it('renders English messages correctly and tagline differs from Spanish', () => {
    render(
      <NextIntlClientProvider
        locale="en"
        messages={getMessages('en')}
        timeZone="America/Bogota"
      >
        <I18nChild />
      </NextIntlClientProvider>,
    );

    expect(screen.getByTestId('app-name')).toHaveTextContent('Cóndor');
    const enTagline = screen.getByTestId('tagline').textContent;
    expect(enTagline).toBe('It sees everything from above.');
    expect(enTagline).not.toBe('Lo ve todo desde arriba.');
  });
});
