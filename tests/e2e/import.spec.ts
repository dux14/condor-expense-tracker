import { test, expect, type Page, type Route } from '@playwright/test'
import { stubSession } from './_auth'

// ---------------------------------------------------------------------------
// Strategy
// ---------------------------------------------------------------------------
// ImportFlow calls `extractStatementText(file)` which lazy-imports `unpdf`.
// In e2e we stub extraction at the JS-chunk level: any response whose body
// contains the `extractStatementText` function is intercepted and the export
// is replaced with a deterministic stub that returns our fixture text — so
// the rest of the pipeline (parseStatement → categorize → ReviewTable) runs
// exactly as in production, giving meaningful coverage of the full
// review→import path.
//
// The fixture text is the same generic-sample lines already committed at
// tests/fixtures/statements/generic-sample.txt (3 expense lines):
//
//   2026-05-03  UBER TRIP 0612 BOGOTA    18.500,00
//   2026-05-04  EXITO SUPER CALLE 80    132.400,50
//   05/05/2026  NETFLIX.COM              38.900,00
//
// The negative line (-50.000,00) is intentionally skipped by the generic
// template (expenses-only), so we expect exactly 3 rows.
// ---------------------------------------------------------------------------

const FIXTURE_TEXT = [
  'ESTADO DE CUENTA',
  'Periodo: 2026-05-01 a 2026-05-31',
  '2026-05-03   UBER TRIP 0612 BOGOTA            18.500,00',
  '2026-05-04   EXITO SUPER CALLE 80             132.400,50',
  '05/05/2026   NETFLIX.COM                       38.900,00',
  '2026-05-09   PAGO RECIBIDO -GRACIAS           -50.000,00',
  'Total cargos 189.800,50',
].join('\n')

const EXPECTED_ROWS = 3 // only the 3 positive expense lines

// ---------------------------------------------------------------------------
// Route interceptor — replaces `extractStatementText` in the JS chunk that
// contains it. Works regardless of Next.js content-hash chunk names.
// ---------------------------------------------------------------------------

async function stubExtraction(page: Page) {
  await page.route('**/_next/static/chunks/**.js', async (route: Route) => {
    const response = await route.fetch()
    const body = await response.text()

    if (!body.includes('extractStatementText')) {
      await route.fulfill({ response })
      return
    }

    // Rewrite the function body in the served chunk so the whole pipeline
    // (parseStatement → categorize → ReviewTable) runs exactly as in
    // production but without touching the filesystem or real PDF parsing.
    // Works in Next.js dev mode where function names survive in output.
    // The global __e2eExtractText__ was injected by addInitScript above.
    const stubbed = body.replace(
      /async function extractStatementText\s*\([^)]*\)\s*\{[\s\S]*?\n\}/,
      `async function extractStatementText(_file){return globalThis.__e2eExtractText__;}`,
    )

    await route.fulfill({
      response,
      body: stubbed,
      contentType: 'text/javascript',
    })
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clearCondorData(page: Page) {
  return page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('condor:')) localStorage.removeItem(key)
    }
  })
}

// Build a minimal valid fake-PDF Blob in-browser so the file input accepts it.
// The real extractStatementText is stubbed so unpdf never runs; we only need
// the magic bytes to survive the NOT_PDF guard — but since we replaced the
// whole function body that guard is also gone. We still pass a real File so
// the onChange handler fires naturally.
async function makeFakePdfBuffer(page: Page): Promise<Buffer> {
  // Minimal PDF: %PDF-1.4 magic + %%EOF — 16 bytes, passes hasPdfMagic.
  return page.evaluate(() => {
    const minimal = '%PDF-1.4\n%%EOF\n'
    return Array.from(new TextEncoder().encode(minimal)) as number[]
  }).then((bytes) => Buffer.from(bytes))
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('F6 — PDF import: review → import flow', () => {
  test.beforeEach(async ({ page }) => {
    // Inject the fixture text into the global scope BEFORE any JS runs.
    await page.addInitScript((text: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(globalThis as any).__e2eExtractText__ = text
    }, FIXTURE_TEXT)

    // Stub the chunk that contains extractStatementText.
    await stubExtraction(page)

    // Auth bypass (same cookie pattern used by all other e2e specs).
    await stubSession(page.context())

    // Navigate to home first so localStorage is accessible, then clear.
    await page.goto('/')
    await clearCondorData(page)
  })

  // ── 1. Review table renders ≥ 1 row from fixture ──────────────────────────
  test('1. upload PDF stub → review table shows expected rows', async ({ page }) => {
    await page.goto('/importar')

    // Wait for the dynamic ImportFlow to hydrate (it has a "…" loading state).
    await expect(page.getByRole('button', { name: /Elegir PDF/i })).toBeVisible({
      timeout: 15_000,
    })

    // Create a fake PDF file in-browser and set it on the hidden input.
    const pdfBytes = await makeFakePdfBuffer(page)
    const fileInput = page.locator('input[type="file"][accept="application/pdf"]')
    await fileInput.setInputFiles({
      name: 'test-statement.pdf',
      mimeType: 'application/pdf',
      buffer: pdfBytes,
    })

    // The component enters "parsing" then "review" phase.
    // Wait for the review heading to appear.
    await expect(page.getByText(/Revisa los gastos/i)).toBeVisible({ timeout: 15_000 })

    // Expect exactly EXPECTED_ROWS rows (3 positive expense lines).
    const checkboxes = page.getByRole('checkbox', { name: /seleccionar fila/i })
    await expect(checkboxes).toHaveCount(EXPECTED_ROWS, { timeout: 10_000 })

    // UBER TRIP description should be visible as a merchant input value.
    await expect(page.locator('input[value*="UBER"]')).toBeVisible()
  })

  // ── 2. Full review → import → redirect to /historico ─────────────────────
  test('2. review → click import → redirects to /historico with imported expense', async ({
    page,
  }) => {
    await page.goto('/importar')

    await expect(page.getByRole('button', { name: /Elegir PDF/i })).toBeVisible({
      timeout: 15_000,
    })

    const pdfBytes = await makeFakePdfBuffer(page)
    const fileInput = page.locator('input[type="file"][accept="application/pdf"]')
    await fileInput.setInputFiles({
      name: 'test-statement.pdf',
      mimeType: 'application/pdf',
      buffer: pdfBytes,
    })

    await expect(page.getByText(/Revisa los gastos/i)).toBeVisible({ timeout: 15_000 })

    // All rows start selected. Click the import button.
    const importBtn = page.getByRole('button', { name: /Importar \d+ gastos/i })
    await expect(importBtn).toBeEnabled()
    await importBtn.click()

    // Should redirect to /historico.
    await expect(page).toHaveURL(/\/historico/, { timeout: 10_000 })

    // At least one transaction row from the import should appear.
    await expect(
      page.locator('[data-testid^="transaction-row-"]').first(),
    ).toBeVisible({ timeout: 10_000 })
  })

  // ── 3. Deselect all → import button disabled ──────────────────────────────
  test('3. deselect all rows → import button is disabled', async ({ page }) => {
    await page.goto('/importar')

    await expect(page.getByRole('button', { name: /Elegir PDF/i })).toBeVisible({
      timeout: 15_000,
    })

    const pdfBytes = await makeFakePdfBuffer(page)
    const fileInput = page.locator('input[type="file"][accept="application/pdf"]')
    await fileInput.setInputFiles({
      name: 'test-statement.pdf',
      mimeType: 'application/pdf',
      buffer: pdfBytes,
    })

    await expect(page.getByText(/Revisa los gastos/i)).toBeVisible({ timeout: 15_000 })

    // Click "Quitar selección" to deselect all.
    await page.getByRole('button', { name: /Quitar selecci/i }).click()

    // Import button should now be disabled (0 selected).
    const importBtn = page.getByRole('button', { name: /Importar 0 gastos/i })
    await expect(importBtn).toBeDisabled()
  })
})
