import { describe, it, expect, vi, type MockedFunction } from 'vitest'
import type { ReviewTableProps } from '@/components/import/ReviewTable'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { ReviewTable } from '@/components/import/ReviewTable'
import type { CategorizedTransaction } from '@/lib/import/rules-engine'
import type { Category } from '@/lib/domain/types'

// ── i18n harness ──────────────────────────────────────────────────────────────
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
}

function withIntl(ui: React.ReactElement) {
  return (
    <NextIntlClientProvider locale="es" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  )
}

// ── fixtures ──────────────────────────────────────────────────────────────────
const categories: Category[] = [
  { id: 'cat-food', name: 'Comida', color: '#C9B6FF', icon: 'comida', isPreset: true },
  { id: 'cat-transport', name: 'Transporte', color: '#FFD700', icon: 'transporte', isPreset: true },
  { id: 'cat-misc', name: 'Otros', color: '#AAAAAA', icon: 'otros', isPreset: false },
]

const rawRows: Array<CategorizedTransaction & { selected: boolean }> = [
  {
    date: '2024-03-15',
    description: 'RAPPI',
    amount: 45000,
    currency: 'COP',
    categoryId: 'cat-food',
    matched: true,
    selected: true,
  },
  {
    date: '2024-03-16',
    description: 'TRANSMILENIO',
    amount: 3200,
    currency: 'COP',
    categoryId: 'cat-transport',
    matched: true,
    selected: false,
  },
  {
    date: '2024-03-17',
    description: 'AMAZON',
    amount: 120000,
    currency: 'COP',
    categoryId: 'cat-misc',
    matched: false,
    selected: true,
  },
]

// ── helpers ───────────────────────────────────────────────────────────────────
type PropOverrides = Partial<{
  rows: typeof rawRows
  onToggle: MockedFunction<ReviewTableProps['onToggle']>
  onToggleAll: MockedFunction<ReviewTableProps['onToggleAll']>
  onEdit: MockedFunction<ReviewTableProps['onEdit']>
  onChangeCategory: MockedFunction<ReviewTableProps['onChangeCategory']>
  onImport: MockedFunction<ReviewTableProps['onImport']>
}>

function makeProps(overrides: PropOverrides = {}): ReviewTableProps {
  return {
    rows: rawRows,
    categories,
    onToggle: vi.fn<ReviewTableProps['onToggle']>(),
    onToggleAll: vi.fn<ReviewTableProps['onToggleAll']>(),
    onEdit: vi.fn<ReviewTableProps['onEdit']>(),
    onChangeCategory: vi.fn<ReviewTableProps['onChangeCategory']>(),
    onImport: vi.fn<ReviewTableProps['onImport']>(),
    ...overrides,
  }
}

// ── tests ─────────────────────────────────────────────────────────────────────
describe('ReviewTable', () => {
  it('renders N rows: shows merchant, amount, date, and category name', () => {
    render(withIntl(<ReviewTable {...makeProps()} />))

    // merchant (description field)
    expect(screen.getByDisplayValue('RAPPI')).toBeInTheDocument()
    expect(screen.getByDisplayValue('TRANSMILENIO')).toBeInTheDocument()
    expect(screen.getByDisplayValue('AMAZON')).toBeInTheDocument()

    // dates
    expect(screen.getByDisplayValue('2024-03-15')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2024-03-16')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2024-03-17')).toBeInTheDocument()

    // amounts
    expect(screen.getByDisplayValue('45000')).toBeInTheDocument()
    expect(screen.getByDisplayValue('3200')).toBeInTheDocument()
    expect(screen.getByDisplayValue('120000')).toBeInTheDocument()

    // category names visible somewhere on screen
    expect(screen.getAllByText('Comida').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Transporte').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Otros').length).toBeGreaterThanOrEqual(1)
  })

  it('clicking a row checkbox calls onToggle with that index', async () => {
    const onToggle = vi.fn()
    render(withIntl(<ReviewTable {...makeProps({ onToggle })} />))

    // rows are labelled by merchant description; checkboxes are within their row card
    const checkboxes = screen.getAllByRole('checkbox', { name: /seleccionar/i })
    await userEvent.click(checkboxes[1])

    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onToggle).toHaveBeenCalledWith(1)
  })

  it('"select all" button calls onToggleAll(true)', async () => {
    const onToggleAll = vi.fn()
    render(withIntl(<ReviewTable {...makeProps({ onToggleAll })} />))

    await userEvent.click(screen.getByRole('button', { name: /seleccionar todo/i }))

    expect(onToggleAll).toHaveBeenCalledTimes(1)
    expect(onToggleAll).toHaveBeenCalledWith(true)
  })

  it('"deselect all" button calls onToggleAll(false)', async () => {
    const onToggleAll = vi.fn()
    render(withIntl(<ReviewTable {...makeProps({ onToggleAll })} />))

    await userEvent.click(screen.getByRole('button', { name: /quitar selecci/i }))

    expect(onToggleAll).toHaveBeenCalledTimes(1)
    expect(onToggleAll).toHaveBeenCalledWith(false)
  })

  it('editing merchant input calls onEdit(index, { merchant })', async () => {
    const onEdit = vi.fn()
    render(withIntl(<ReviewTable {...makeProps({ onEdit })} />))

    const merchantInput = screen.getByDisplayValue('RAPPI')
    await userEvent.clear(merchantInput)
    await userEvent.type(merchantInput, 'RAPPI NEW')

    // last onEdit call for the merchant of row 0
    const calls = onEdit.mock.calls
    const lastCall = calls[calls.length - 1]
    expect(lastCall[0]).toBe(0)
    expect(lastCall[1]).toHaveProperty('merchant', 'RAPPI NEW')
  })

  it('editing amount input calls onEdit(index, { amount: <number> })', async () => {
    const onEdit = vi.fn()
    render(withIntl(<ReviewTable {...makeProps({ onEdit })} />))

    const amountInput = screen.getByDisplayValue('45000')
    await userEvent.clear(amountInput)
    await userEvent.type(amountInput, '50000')

    const calls = onEdit.mock.calls
    const lastCall = calls[calls.length - 1]
    expect(lastCall[0]).toBe(0)
    expect(lastCall[1]).toHaveProperty('amount', 50000)
  })

  it('opening category picker and choosing a chip calls onChangeCategory(index, categoryId)', async () => {
    const onChangeCategory = vi.fn()
    render(withIntl(<ReviewTable {...makeProps({ onChangeCategory })} />))

    // Open the category picker for row 0 (RAPPI, currently cat-food)
    const categoryTriggers = screen.getAllByRole('button', { name: /categoría|comida|transporte|otros/i })
    // The first trigger button for row 0 that shows current category
    const row0Trigger = categoryTriggers.find((btn) => btn.textContent?.includes('Comida'))
    expect(row0Trigger).toBeDefined()
    await userEvent.click(row0Trigger!)

    // CategoryChip grid is now visible; click Transporte
    const transporteChip = screen.getByRole('button', { name: /transporte/i })
    await userEvent.click(transporteChip)

    expect(onChangeCategory).toHaveBeenCalledTimes(1)
    expect(onChangeCategory).toHaveBeenCalledWith(0, 'cat-transport')
  })

  it('footer shows "Importar {n} gastos" with selected count and calls onImport', async () => {
    const onImport = vi.fn()
    // 2 rows selected (index 0 and 2)
    render(withIntl(<ReviewTable {...makeProps({ onImport })} />))

    const importBtn = screen.getByRole('button', { name: /importar 2 gastos/i })
    expect(importBtn).toBeEnabled()
    await userEvent.click(importBtn)

    expect(onImport).toHaveBeenCalledTimes(1)
  })

  it('footer import button is disabled when 0 rows are selected', () => {
    const allUnselected = rawRows.map((r) => ({ ...r, selected: false }))
    render(withIntl(<ReviewTable {...makeProps({ rows: allUnselected })} />))

    const importBtn = screen.getByRole('button', { name: /importar 0 gastos/i })
    expect(importBtn).toBeDisabled()
  })
})
