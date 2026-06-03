import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CategoryChip } from '@/components/category/CategoryChip'
import { ColorSwatchPicker } from '@/components/category/ColorSwatchPicker'
import type { Category } from '@/lib/domain/types'
import { CATEGORY_PALETTE } from '@/lib/domain/palette'

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
      <ColorSwatchPicker
        value={CATEGORY_PALETTE[0]}
        onChange={onChange}
      />,
    )

    // Click the second palette swatch
    const secondHex = CATEGORY_PALETTE[1]
    const swatch = screen.getByRole('button', { name: new RegExp(secondHex, 'i') })
    await userEvent.click(swatch)

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(secondHex)
  })
})
