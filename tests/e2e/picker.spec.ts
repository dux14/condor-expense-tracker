import { test, expect } from '@playwright/test'
import { stubSession } from './_auth'

// The native date/time inputs are opacity-0 overlays (so not "visible" in the
// toBeVisible sense), but they ARE the real interactive tap targets (Path 1).
// We assert they are enabled and that a `fill` propagates to the visible label.
test.describe('Cóndor /anadir native date & time pickers', () => {
  test.beforeEach(async ({ page }) => {
    await stubSession(page.context())
    await page.goto('/anadir')
    await expect(page.getByTestId('amount-input')).toBeVisible({ timeout: 10_000 })
  })

  test('date input is enabled and updates the visible label on change', async ({ page }) => {
    const dateInput = page.locator('input[type="date"]').first()
    await expect(dateInput).toBeEnabled()

    await dateInput.fill('2026-12-25')

    // The visible presentational label should reflect the new date (es format: "25 dic 2026")
    await expect(page.getByText(/25 dic 2026/i)).toBeVisible()
  })

  test('time input is enabled and updates the visible label on change', async ({ page }) => {
    const timeInput = page.locator('input[type="time"]').first()
    await expect(timeInput).toBeEnabled()

    await timeInput.fill('09:45')

    await expect(page.getByText('09:45')).toBeVisible()
  })
})
