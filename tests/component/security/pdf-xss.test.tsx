import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { ReviewTable } from '@/components/import/ReviewTable';
import type { CategorizedTransaction } from '@/lib/import/rules-engine';
import type { Category } from '@/lib/domain/types';

// i18n harness — mirror the inline messages from tests/component/ReviewTable.test.tsx
const messages = {
  Importar: {
    title: 'Importar extracto',
    subtitle: 'Tu PDF se procesa en tu dispositivo. Nunca se sube a internet.',
    pickFile: 'Elegir PDF',
    parsing: 'Leyendo el extracto…',
    reviewTitle: 'Revisa los gastos',
    selectAll: 'Seleccionar todo',
    deselectAll: 'Quitar selección',
    importN: 'Importar {n} gastos',
    imported: '{n} gastos importados',
    empty: 'No se encontraron transacciones en este PDF.',
    colDate: 'Fecha',
    colMerchant: 'Comercio',
    colAmount: 'Monto',
    colCategory: 'Categoría',
    errNotPdf: 'El archivo no es un PDF.',
    errTooLarge: 'El PDF supera 10 MB.',
    errTooManyPages: 'El PDF tiene más de 50 páginas.',
    errExtract: 'No se pudo leer el PDF.',
  },
};

function withIntl(ui: React.ReactElement) {
  return (
    <NextIntlClientProvider locale="es" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  );
}

const MALICIOUS = '<script>window.__xss=1</script><img src=x onerror="window.__xss=1">';
const categories: Category[] = [
  { id: 'cat-misc', name: 'Otros', color: '#AAAAAA', icon: 'otros', isPreset: false },
];

describe('PDF import review escapes merchant text (no XSS)', () => {
  it('renders a malicious merchant as inert text, executes nothing', () => {
    (window as unknown as { __xss?: number }).__xss = undefined;
    const rows: Array<CategorizedTransaction & { selected: boolean }> = [
      {
        date: '2026-01-01',
        description: MALICIOUS,
        amount: 1000,
        currency: 'COP',
        categoryId: 'cat-misc',
        matched: false,
        selected: true,
      },
    ];
    render(
      withIntl(
        <ReviewTable
          rows={rows}
          categories={categories}
          onToggle={vi.fn()}
          onToggleAll={vi.fn()}
          onEdit={vi.fn()}
          onChangeCategory={vi.fn()}
          onImport={vi.fn()}
        />,
      ),
    );
    // The malicious string is shown verbatim as an input value (React escapes it); nothing executed.
    expect(screen.getByDisplayValue(MALICIOUS)).toBeInTheDocument();
    expect((window as unknown as { __xss?: number }).__xss).toBeUndefined();
    // No live <script> was injected from merchant text.
    expect(document.querySelector('script[data-from-merchant]')).toBeNull();
  });
});
