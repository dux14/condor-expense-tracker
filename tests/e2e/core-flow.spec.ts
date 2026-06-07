import { test, expect, type Page, type Route } from '@playwright/test'
import { stubSession } from './_auth'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Seed a COP expense directly into localStorage so the store picks it up on
 * next hydration. Returns a predictable expense id.
 */
async function seedExpense(
  page: Page,
  opts: {
    id?: string
    amount: number
    currency: string
    baseAmount: number | null
    fxRate: number | null
    categoryId: string
    date: string
  },
) {
  const id = opts.id ?? crypto.randomUUID()
  await page.evaluate(
    ({ KEYS, expense }: { KEYS: { expenses: string; categories: string }; expense: object }) => {
      const raw = localStorage.getItem(KEYS.expenses)
      const list = raw ? JSON.parse(raw) : []
      list.push(expense)
      localStorage.setItem(KEYS.expenses, JSON.stringify(list))
    },
    {
      KEYS: { expenses: 'condor:expenses', categories: 'condor:categories' },
      expense: {
        id,
        amount: opts.amount,
        currency: opts.currency,
        baseAmount: opts.baseAmount,
        fxRate: opts.fxRate,
        date: opts.date,
        categoryId: opts.categoryId,
        merchant: undefined,
        note: undefined,
        source: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    },
  )
  return id
}

/**
 * Set up a route mock that fulfills FX requests deterministically.
 * USD → COP rate = 4000 (so COP → USD = 0.00025; the app fetches from→base)
 * The mock parses the ?to= param so the rates key is correct.
 */
async function mockFxOnline(page: Page) {
  await page.route('**://api.frankfurter.app/**', async (route: Route) => {
    const url = new URL(route.request().url())
    const to = url.searchParams.get('to') ?? 'COP'
    const from = url.searchParams.get('from') ?? 'USD'
    // Use rate 4000 for USD→COP direction, inverse for others
    const rate = from === 'USD' && to === 'COP' ? 4000 : from === 'COP' && to === 'USD' ? 0.00025 : 1
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        amount: 1,
        base: from,
        date: url.pathname.replace('/', ''),
        rates: { [to]: rate },
      }),
    })
  })
}

/** Abort all FX requests (simulate offline). */
async function mockFxOffline(page: Page) {
  await page.route('**://api.frankfurter.app/**', async (route: Route) => {
    await route.abort()
  })
}

// Today in yyyy-MM-dd for seeding expenses in the current month
function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe('Cóndor core flow', () => {
  test.beforeEach(async ({ page }) => {
    await stubSession(page.context())
    await page.goto('/')
    // Clear any leftover data from previous tests
    await page.evaluate(() => {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('condor:')) localStorage.removeItem(key)
      }
    })
    await page.reload()
    // Wait for hydration
    await expect(page.locator('[data-testid="month-total"]')).toBeVisible({ timeout: 10_000 })
  })

  // ── 1. Add → Home reflects it ─────────────────────────────────────────────
  test('1. add expense → home shows total and ranked bar', async ({ page }) => {
    await mockFxOnline(page)

    // Go to /anadir
    await page.goto('/anadir')
    await expect(page.getByTestId('amount-input')).toBeVisible()

    // Type amount
    await page.getByTestId('amount-input').fill('50000')

    // Currency should already be COP (base) — confirm the pill is visible
    await expect(page.getByTestId('currency-pill')).toBeVisible()

    // Pick Comida category chip
    await page.getByRole('button', { name: /Comida/i }).click()

    // Click the primary save button
    await page.getByTestId('save-expense').click()

    // Should navigate back to Home
    await expect(page).toHaveURL('/')

    // Month total should show non-zero
    const total = page.getByTestId('month-total')
    await expect(total).toBeVisible()
    await expect(total).not.toHaveText(/^\$ 0/)

    // A ranked bar for Comida should appear
    await expect(page.getByTestId('ranked-bar-preset-comida')).toBeVisible()
  })

  // ── 2. Drill-in via category bar ─────────────────────────────────────────
  test('2. click category bar → /historico?cat= with transaction listed', async ({ page }) => {
    await mockFxOnline(page)

    // Seed an expense
    await seedExpense(page, {
      amount: 30000,
      currency: 'COP',
      baseAmount: 30000,
      fxRate: 1,
      categoryId: 'preset-comida',
      date: todayKey(),
    })
    await page.reload()
    await expect(page.getByTestId('month-total')).toBeVisible({ timeout: 10_000 })

    // Click the Comida bar
    await page.getByTestId('ranked-bar-preset-comida').click()

    // URL should include /historico?cat=preset-comida
    await expect(page).toHaveURL(/\/historico\?cat=preset-comida/)

    // At least one transaction row should be visible
    await expect(page.locator('[data-testid^="transaction-row-"]').first()).toBeVisible()
  })

  // ── 3. Edit expense ───────────────────────────────────────────────────────
  test('3. edit expense → updated amount shown on historico', async ({ page }) => {
    await mockFxOnline(page)

    const expId = await seedExpense(page, {
      id: 'test-edit-id',
      amount: 10000,
      currency: 'COP',
      baseAmount: 10000,
      fxRate: 1,
      categoryId: 'preset-comida',
      date: todayKey(),
    })
    await page.reload()
    await expect(page.getByTestId('month-total')).toBeVisible({ timeout: 10_000 })

    // Go to historico and click the row
    await page.goto('/historico')
    await expect(page.locator('[data-testid^="transaction-row-"]').first()).toBeVisible()
    await page.locator(`[data-testid="transaction-row-${expId}"]`).click()

    // Should be on /anadir?id=...
    await expect(page).toHaveURL(/\/anadir\?id=/)
    await expect(page.getByTestId('amount-input')).toBeVisible()

    // Change the amount
    await page.getByTestId('amount-input').fill('99999')
    // Save (top-right save button or primary button)
    await page.getByTestId('save-expense').click()

    // Should navigate to /historico
    await expect(page).toHaveURL('/historico')

    // The updated amount should be visible somewhere on page
    // COP 99.999 in es-CO format
    await expect(page.getByText(/99\.999|99,999/).first()).toBeVisible()
  })

  // ── 4. Delete expense ─────────────────────────────────────────────────────
  test('4. delete expense → gone from list', async ({ page }) => {
    await mockFxOnline(page)

    const expId = await seedExpense(page, {
      id: 'test-delete-id',
      amount: 5000,
      currency: 'COP',
      baseAmount: 5000,
      fxRate: 1,
      categoryId: 'preset-comida',
      date: todayKey(),
    })
    await page.reload()
    await expect(page.getByTestId('month-total')).toBeVisible({ timeout: 10_000 })

    await page.goto('/historico')
    await expect(page.locator(`[data-testid="transaction-row-${expId}"]`)).toBeVisible()

    // Click the row to open edit mode
    await page.locator(`[data-testid="transaction-row-${expId}"]`).click()
    await expect(page).toHaveURL(/\/anadir\?id=/)

    // Click the delete icon (trash) in the header to open confirm dialog
    await page.getByRole('button', { name: /Eliminar/i }).first().click()

    // Confirm the delete in the dialog
    // The confirm button inside the AlertDialog
    const confirmBtn = page.getByRole('button', { name: /Eliminar/i }).last()
    await expect(confirmBtn).toBeVisible()
    await confirmBtn.click()

    // Should navigate to /historico with empty state or row gone
    await expect(page).toHaveURL('/historico')
    await expect(page.locator(`[data-testid="transaction-row-${expId}"]`)).toHaveCount(0)
  })

  // ── 5. View switch persists across reload ─────────────────────────────────
  test('5. switch to donut view → reload → donut still active', async ({ page }) => {
    await mockFxOnline(page)

    // Need at least one expense to show the view switcher
    await seedExpense(page, {
      amount: 20000,
      currency: 'COP',
      baseAmount: 20000,
      fxRate: 1,
      categoryId: 'preset-comida',
      date: todayKey(),
    })
    await page.reload()
    await expect(page.getByTestId('month-total')).toBeVisible({ timeout: 10_000 })

    // Click the "Dona" segment in the view switcher
    await page.getByTestId('segment-donut').click()

    // Reload
    await page.reload()
    await expect(page.getByTestId('month-total')).toBeVisible({ timeout: 10_000 })

    // The donut segment should now be aria-checked
    const donutBtn = page.getByTestId('segment-donut')
    await expect(donutBtn).toHaveAttribute('aria-checked', 'true')
  })

  // ── 6. Change base currency recomputes ────────────────────────────────────
  test('6. change base currency → home total recomputes', async ({ page }) => {
    await mockFxOnline(page)

    // Seed one COP expense
    await seedExpense(page, {
      amount: 40000,
      currency: 'COP',
      baseAmount: 40000,
      fxRate: 1,
      categoryId: 'preset-comida',
      date: todayKey(),
    })
    await page.reload()
    await expect(page.getByTestId('month-total')).toBeVisible({ timeout: 10_000 })

    // Grab initial total text
    const totalEl = page.getByTestId('month-total')
    const initialText = await totalEl.textContent()

    // Go to Ajustes and change base currency to USD
    await page.goto('/ajustes')
    await expect(page.getByText('Moneda base')).toBeVisible()

    // Open the base currency select
    const currencySelect = page.getByRole('combobox').first()
    await currencySelect.click()
    // Select USD from the dropdown
    await page.getByRole('option', { name: 'USD' }).click()

    // Go back home
    await page.goto('/')
    await expect(page.getByTestId('month-total')).toBeVisible({ timeout: 10_000 })

    // Total should have changed (different currency format)
    const newText = await page.getByTestId('month-total').textContent()
    expect(newText).not.toBe(initialText)
    // USD format should contain "US$" or "USD" or similar
    expect(newText).toMatch(/US\$|USD|\$/)
  })

  // ── 7. Offline add degrades gracefully ────────────────────────────────────
  test('7. offline add USD expense → saved, shows "sin conversión"', async ({ page }) => {
    await mockFxOffline(page)

    await page.goto('/anadir')
    await expect(page.getByTestId('amount-input')).toBeVisible()

    // Type a USD amount
    await page.getByTestId('amount-input').fill('100')

    // Change currency to USD via CurrencyPill
    await page.getByTestId('currency-pill').click()
    await page.getByRole('option', { name: 'USD' }).first().click()

    // Pick Comida category
    await page.getByRole('button', { name: /Comida/i }).click()

    // Save
    await page.getByTestId('save-expense').click()

    // Should land on home (base currency is still COP, USD expense saved)
    await expect(page).toHaveURL('/')
    await expect(page.getByTestId('month-total')).toBeVisible({ timeout: 10_000 })

    // Go to historico to check the "sin conversión" tag
    await page.goto('/historico')
    await expect(page.locator('[data-testid^="transaction-row-"]').first()).toBeVisible()
    // The no_conversion badge
    await expect(page.getByText('sin conversión')).toBeVisible()
  })

  // ── 8. Export + Wipe ─────────────────────────────────────────────────────
  test('8. export triggers download, wipe clears data', async ({ page }) => {
    await mockFxOnline(page)

    // Seed an expense first
    await seedExpense(page, {
      amount: 15000,
      currency: 'COP',
      baseAmount: 15000,
      fxRate: 1,
      categoryId: 'preset-comida',
      date: todayKey(),
    })
    await page.reload()
    await expect(page.getByTestId('month-total')).toBeVisible({ timeout: 10_000 })

    await page.goto('/ajustes')

    // Export — capture download event
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-btn').click(),
    ])
    // Filename should contain 'condor'
    expect(download.suggestedFilename()).toContain('condor')

    // Wipe all data
    await page.getByTestId('wipe-btn').click()

    // Confirm the wipe in the dialog
    const confirmBtn = page.getByRole('button', { name: /Eliminar|Confirmar|Borrar/i }).last()
    await expect(confirmBtn).toBeVisible()
    await confirmBtn.click()

    // Go home — should show empty state
    await page.goto('/')
    await expect(page.getByTestId('month-total')).toBeVisible({ timeout: 10_000 })
    // Empty state text
    await expect(page.getByText('Sin gastos este mes')).toBeVisible()
  })

  // ── 9. ES↔EN language switch ─────────────────────────────────────────────
  test('9. switch language to English → UI shows English strings', async ({ page }) => {
    // Default is Spanish — verify
    await expect(page.getByText('Gastado este mes')).toBeVisible()

    await page.goto('/ajustes')
    await expect(page.getByText('Idioma')).toBeVisible()

    // Find the Idioma select and switch to English
    // Find the one near the Idioma label
    const idiomaRow = page.getByText('Idioma').locator('../..')
    const langSelect = idiomaRow.getByRole('combobox').first()
    await langSelect.click()
    await page.getByRole('option', { name: 'English' }).click()

    // Go home — should now show English
    await page.goto('/')
    await expect(page.getByTestId('month-total')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Spent this month')).toBeVisible()
  })

  // ── 10. Dark/Light theme toggle ───────────────────────────────────────────
  test('10. theme: Claro → light class; Oscuro → dark class', async ({ page }) => {
    await page.goto('/ajustes')

    // Click the "Claro" (Light) theme segment
    await page.getByTestId('segment-light').click()

    // documentElement should have class 'light'
    const htmlClass = await page.evaluate(() => document.documentElement.className)
    expect(htmlClass).toContain('light')
    expect(htmlClass).not.toContain('dark')

    // Switch to Oscuro (Dark)
    await page.getByTestId('segment-dark').click()

    const htmlClassDark = await page.evaluate(() => document.documentElement.className)
    expect(htmlClassDark).toContain('dark')
    expect(htmlClassDark).not.toContain('light')
  })
})
