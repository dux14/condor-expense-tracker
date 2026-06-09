import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { CategoryChip } from '@/components/category/CategoryChip'
import { ColorSwatchPicker } from '@/components/category/ColorSwatchPicker'
import { NewCategorySheet } from '@/components/category/NewCategorySheet'
import { BudgetProgressLine } from '@/components/category/BudgetProgressLine'
import type { Category } from '@/lib/domain/types'
import { CATEGORY_PALETTE } from '@/lib/domain/palette'

const messages = {
  Categorias: {
    selectIcon: 'Seleccionar ícono',
    colorSwatch: 'Color {hex}',
    customColor: 'Color personalizado',
    pickCustomColor: 'Elegir color personalizado',
    title: 'Categorías',
    title_new: 'Nueva categoría',
    title_edit: 'Editar categoría',
    name_label: 'Nombre',
    name_placeholder: 'Ej. Gimnasio',
    color_label: 'Color',
    icon_label: 'Ícono',
    save: 'Guardar',
    presets: 'PREDETERMINADAS',
    custom: 'PERSONALIZADAS',
    newCategory: 'Nueva categoría',
    palette: 'PALETA SUGERIDA',
    reassignWarning: 'Reasignar',
    deleteTitle: 'Eliminar categoría',
    budget_label: 'Presupuesto mensual',
    budget_placeholder: 'Sin presupuesto',
    budget_optional: 'Opcional',
    spentOfBudget: '{spent} de {budget}',
    overBudget: 'Sobre el presupuesto',
  },
}

function withIntl(ui: React.ReactElement) {
  return (
    <NextIntlClientProvider locale="es" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  )
}

const mockCategory: Category = {
  id: 'cat-001',
  name: 'Comida',
  color: '#C9B6FF',
  icon: 'comida',
  isPreset: true,
}

describe('CategoryChip', () => {
  it('calls onSelect with category id when clicked', async () => {
    const onSelect = vi.fn()
    render(
      <CategoryChip
        category={mockCategory}
        selected={false}
        onSelect={onSelect}
      />,
    )

    const chip = screen.getByRole('button', { name: /comida/i })
    await userEvent.click(chip)

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('cat-001')
  })

  it('reflects selected=false via aria-pressed', () => {
    render(
      <CategoryChip
        category={mockCategory}
        selected={false}
        onSelect={vi.fn()}
      />,
    )

    const chip = screen.getByRole('button', { name: /comida/i })
    expect(chip).toHaveAttribute('aria-pressed', 'false')
  })

  it('reflects selected=true via aria-pressed', () => {
    render(
      <CategoryChip
        category={mockCategory}
        selected={true}
        onSelect={vi.fn()}
      />,
    )

    const chip = screen.getByRole('button', { name: /comida/i })
    expect(chip).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('ColorSwatchPicker', () => {
  it('calls onChange with the hex when a palette swatch is clicked', async () => {
    const onChange = vi.fn()
    render(
      withIntl(
        <ColorSwatchPicker
          value={CATEGORY_PALETTE[0]}
          onChange={onChange}
        />,
      ),
    )

    // Click the second palette swatch
    const secondHex = CATEGORY_PALETTE[1]
    const swatch = screen.getByRole('button', { name: new RegExp(secondHex, 'i') })
    await userEvent.click(swatch)

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(secondHex)
  })
})

describe('NewCategorySheet budget field', () => {
  it('passes budgetBase parsed from the input on submit', async () => {
    const onSubmit = vi.fn()
    render(withIntl(
      <NewCategorySheet open onOpenChange={vi.fn()} onSubmit={onSubmit} />,
    ))
    // name_label has no htmlFor association — use placeholder to locate the name input
    await userEvent.type(screen.getByPlaceholderText(/ej\. gimnasio/i), 'Gym')
    await userEvent.type(screen.getByLabelText(/presupuesto mensual/i), '250000')
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Gym', budgetBase: 250000 }))
  })

  it('submits budgetBase null when the budget field is left empty', async () => {
    const onSubmit = vi.fn()
    render(withIntl(
      <NewCategorySheet open onOpenChange={vi.fn()} onSubmit={onSubmit} />,
    ))
    await userEvent.type(screen.getByPlaceholderText(/ej\. gimnasio/i), 'Gym')
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ budgetBase: null }))
  })

  it('prefills the budget field from initial.budgetBase when editing', () => {
    render(withIntl(
      <NewCategorySheet open onOpenChange={vi.fn()}
        initial={{ name: 'Comida', color: '#fff', icon: 'comida', budgetBase: 300000 }}
        onSubmit={vi.fn()} />,
    ))
    expect(screen.getByLabelText(/presupuesto mensual/i)).toHaveValue('300000')
  })
})

describe('BudgetProgressLine', () => {
  it('renders spent/budget and pct, no over markers under budget', () => {
    render(withIntl(
      <BudgetProgressLine spentBase={50000} budgetBase={100000} pct={50} over={false} baseCurrency="COP" locale="es" />,
    ))
    expect(screen.getByText(/50%/)).toBeInTheDocument()
    expect(screen.queryByText(/sobre el presupuesto/i)).not.toBeInTheDocument()
  })

  it('over budget exposes an accessible label and pct text (not color alone)', () => {
    render(withIntl(
      <BudgetProgressLine spentBase={180000} budgetBase={100000} pct={180} over baseCurrency="COP" locale="es" />,
    ))
    expect(screen.getByText(/180%/)).toBeInTheDocument()
    expect(screen.getByText(/sobre el presupuesto/i)).toBeInTheDocument() // sr-only text present
  })
})
