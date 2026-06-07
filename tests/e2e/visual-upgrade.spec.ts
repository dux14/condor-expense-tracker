import { test, expect, type Page } from '@playwright/test'
import { stubSession } from './_auth'

// ---------------------------------------------------------------------------
// E2E coverage for the visual-upgrade batch:
//   1. no horizontal overflow at 375px on any route
//   2. category chip shows a visible selected state
//   3. live thousands separators in the amount input
//   4. categories (incl. presets) are editable in place
//   5. expenses capture and display a time
// ---------------------------------------------------------------------------

async function clearCondorData(page: Page) {
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('condor:')) localStorage.removeItem(key)
    }
  })
}

test.describe('Visual upgrade', () => {
  test.beforeEach(async ({ page }) => {
    await stubSession(page.context())
    await page.goto('/')
    await clearCondorData(page)
  })

  test('no horizontal overflow at 375px on any route', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    for (const route of ['/', '/anadir', '/historico', '/categorias', '/ajustes']) {
      await page.goto(route)
      await page.waitForLoadState('networkidle')
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      )
      expect(overflow, `route ${route} overflows horizontally`).toBeLessThanOrEqual(0)
    }
  })

  test('category chip shows a visible selected state', async ({ page }) => {
    await page.goto('/anadir')
    const chips = page.locator('button[aria-pressed]')
    await expect(chips.first()).toBeVisible()

    const before = await chips.first().evaluate((el) => getComputedStyle(el).boxShadow)
    await chips.first().click()
    await expect(chips.first()).toHaveAttribute('aria-pressed', 'true')
    const after = await chips.first().evaluate((el) => getComputedStyle(el).boxShadow)

    // The selected chip must paint differently (mint ring + elevation)
    expect(after).not.toBe(before)
    expect(after).not.toBe('none')
  })

  test('amount input groups thousands live (es locale)', async ({ page }) => {
    await page.goto('/anadir')
    const amount = page.getByTestId('amount-input')
    await amount.fill('')
    await amount.pressSequentially('1450000')
    await expect(amount).toHaveValue('1.450.000')
  })

  test('preset category can be renamed in place', async ({ page }) => {
    await page.goto('/categorias')

    await page.getByRole('button', { name: /editar comida/i }).click()
    const nameInput = page.locator('input[value="Comida"]')
    await expect(nameInput).toBeVisible()
    await nameInput.fill('Restaurantes')
    await page.getByRole('button', { name: /^guardar$/i }).click()

    await expect(page.getByText('Restaurantes')).toBeVisible()
    // Edit-in-place: the preset id must survive the rename
    const cat = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('condor:categories') ?? '[]').find(
        (c: { id: string }) => c.id === 'preset-comida',
      ),
    )
    expect(cat.name).toBe('Restaurantes')
    expect(cat.isPreset).toBe(true)
  })

  test('expense captures a default time and shows it in historico', async ({ page }) => {
    await page.goto('/anadir')

    // Time row defaults to the current local time
    const timeButton = page.getByRole('button', { name: /^hora:/i })
    await expect(timeButton).toHaveText(/\d{2}:\d{2}/)

    await page.getByTestId('amount-input').pressSequentially('25000')
    await page.locator('button[aria-pressed]').first().click()
    await page.getByTestId('save-expense').click()
    await page.waitForURL('**/')

    const saved = await page.evaluate(
      () => JSON.parse(localStorage.getItem('condor:expenses') ?? '[]')[0],
    )
    expect(saved.time).toMatch(/^\d{2}:\d{2}$/)

    await page.goto('/historico')
    await expect(page.getByText(saved.time, { exact: false }).first()).toBeVisible()
  })
})
