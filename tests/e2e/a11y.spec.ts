import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { stubSession } from './_auth'

// ---------------------------------------------------------------------------
// Seed helper (mirrors core-flow pattern)
// ---------------------------------------------------------------------------
function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

async function seedData(page: import('@playwright/test').Page) {
  await page.addInitScript(
    ({ today }: { today: string }) => {
      const EXPENSES_KEY = 'condor:expenses'
      const SETTINGS_KEY = 'condor:settings'

      const expenses = [
        {
          id: 'a11y-exp-1',
          amount: 50000,
          currency: 'COP',
          baseAmount: 50000,
          fxRate: 1,
          date: today,
          categoryId: 'preset-comida',
          source: 'manual',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'a11y-exp-2',
          amount: 30000,
          currency: 'COP',
          baseAmount: 30000,
          fxRate: 1,
          date: today,
          categoryId: 'preset-transporte',
          source: 'manual',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'a11y-exp-3',
          amount: 20000,
          currency: 'COP',
          baseAmount: 20000,
          fxRate: 1,
          date: today,
          categoryId: 'preset-salud',
          source: 'manual',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]

      localStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses))
      // Keep existing settings or set defaults
      if (!localStorage.getItem(SETTINGS_KEY)) {
        localStorage.setItem(
          SETTINGS_KEY,
          JSON.stringify({
            baseCurrency: 'COP',
            locale: 'es',
            theme: 'dark',
            dashboardView: 'bars',
          }),
        )
      }
    },
    { today: todayKey() },
  )
}

// ---------------------------------------------------------------------------
// Shared axe runner — filters to serious + critical only for the gate,
// but logs ALL violations for visibility.
// ---------------------------------------------------------------------------
async function runAxe(page: import('@playwright/test').Page, route: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze()

  const allViolations = results.violations
  const serious = allViolations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  )
  const minor = allViolations.filter(
    (v) => v.impact === 'moderate' || v.impact === 'minor',
  )

  if (allViolations.length > 0) {
    console.log(
      `\n[a11y] ${route} — ${allViolations.length} total violation(s):`,
      allViolations.map((v) => `${v.impact}:${v.id}`).join(', '),
    )
  }
  if (minor.length > 0) {
    console.log(
      `[a11y] ${route} — moderate/minor (NOT blocking):`,
      minor.map((v) => v.id).join(', '),
    )
  }

  // Gate: no serious or critical violations
  expect(
    serious,
    `Serious/critical a11y violations on ${route}: ${serious.map((v) => v.id).join(', ')}`,
  ).toHaveLength(0)
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe('Accessibility (axe wcag2a + wcag2aa)', () => {
  // / — Home (bars view)
  test('/ — home page passes axe (bars view, with data)', async ({ page }) => {
    await stubSession(page.context())
    await seedData(page)
    await page.goto('/')
    // Wait for store hydration
    await expect(page.getByTestId('month-total')).toBeVisible({ timeout: 10_000 })
    await runAxe(page, '/')
  })

  // / — Home (donut view)
  test('/ — home page passes axe (donut view)', async ({ page }) => {
    await stubSession(page.context())
    await seedData(page)
    await page.goto('/')
    await expect(page.getByTestId('month-total')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('segment-donut').click()
    await runAxe(page, '/ donut')
  })

  // / — Home (treemap view)
  test('/ — home page passes axe (treemap view)', async ({ page }) => {
    await stubSession(page.context())
    await seedData(page)
    await page.goto('/')
    await expect(page.getByTestId('month-total')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('segment-treemap').click()
    await runAxe(page, '/ treemap')
  })

  // /anadir
  test('/anadir — add expense page passes axe', async ({ page }) => {
    await stubSession(page.context())
    await seedData(page)
    await page.goto('/anadir')
    await expect(page.getByTestId('amount-input')).toBeVisible({ timeout: 10_000 })
    await runAxe(page, '/anadir')
  })

  // /categorias
  test('/categorias — categories page passes axe', async ({ page }) => {
    await stubSession(page.context())
    await seedData(page)
    await page.goto('/categorias')
    // Wait for page to settle
    await page.waitForLoadState('networkidle')
    await runAxe(page, '/categorias')
  })

  // /ajustes
  test('/ajustes — settings page passes axe', async ({ page }) => {
    await stubSession(page.context())
    await seedData(page)
    await page.goto('/ajustes')
    await page.waitForLoadState('networkidle')
    await runAxe(page, '/ajustes')
  })

  // /historico
  test('/historico — historico page passes axe', async ({ page }) => {
    await stubSession(page.context())
    await seedData(page)
    await page.goto('/historico')
    // Wait for transaction rows to appear
    await expect(
      page.locator('[data-testid^="transaction-row-"]').first(),
    ).toBeVisible({ timeout: 10_000 })
    await runAxe(page, '/historico')
  })
})
