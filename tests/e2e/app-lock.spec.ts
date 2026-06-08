import { test, expect } from '@playwright/test'
import { stubSession } from './_auth'

// ---------------------------------------------------------------------------
// F2 app-lock e2e
//
// I1 — PIN flow: enable lock + set PIN, reload to engage the lock, then prove
//      a wrong PIN is rejected and the correct PIN unlocks the app.
// I2 — WebAuthn biometric flow via a CDP virtual authenticator that auto-approves
//      user verification, so the LockScreen auto-prompt dismisses with no PIN.
//
// Auth gate: middleware redirects unauthenticated requests to /login for all
// non-public paths. stubSession() sets the `e2e-auth=1` cookie the middleware
// honors when NODE_ENV !== 'production'. It MUST run before the first goto.
// ---------------------------------------------------------------------------

test.describe('app-lock PIN flow', () => {
  test.beforeEach(async ({ page }) => {
    await stubSession(page.context())
    await page.goto('/')
    // Clear any leftover lock/app state from previous tests.
    await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith('condor:')) localStorage.removeItem(k)
      }
    })
    await page.reload()
  })

  test('enable lock + PIN → reload locks app → correct PIN unlocks', async ({ page }) => {
    await page.goto('/ajustes')
    await page.getByRole('switch', { name: /Bloqueo de la app/i }).click()
    await page.getByLabel(/Nuevo PIN/i).fill('1234')
    await page.getByLabel(/Confirma el PIN/i).fill('1234')
    await page.getByRole('button', { name: /Guardar|Confirmar/i }).click()

    // Enabling persists config but does not lock the mounted page; the lock
    // engages on the next full load (useAppLock reads config on mount).
    await page.goto('/')
    await page.reload()
    const dialog = page.getByRole('dialog', { name: /bloqueado/i })
    await expect(dialog).toBeVisible()

    // Wrong PIN is rejected.
    await page.getByLabel('PIN').fill('0000')
    await page.getByRole('button', { name: 'Desbloquear' }).click()
    await expect(page.getByText('PIN incorrecto')).toBeVisible()

    // Correct PIN unlocks → overlay dismisses, home renders.
    await page.getByLabel('PIN').fill('1234')
    await page.getByRole('button', { name: 'Desbloquear' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByTestId('month-total')).toBeVisible({ timeout: 10_000 })
  })

  test('enable biometric (virtual authenticator) → unlocks on open', async ({ page }) => {
    // Install the CDP virtual authenticator BEFORE any navigation in this test
    // so PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
    // resolves true (gating the "Activar biometría" row) and so navigator
    // .credentials.create/get succeed with auto-approved user verification.
    const client = await page.context().newCDPSession(page)
    await client.send('WebAuthn.enable')
    await client.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: false,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    })

    // beforeEach already ran stubSession + cleared condor:* state. Enable the
    // lock with a PIN first (biometric is layered on top of an enabled lock).
    await page.goto('/ajustes')
    await page.getByRole('switch', { name: /Bloqueo de la app/i }).click()
    await page.getByLabel(/Nuevo PIN/i).fill('1234')
    await page.getByLabel(/Confirma el PIN/i).fill('1234')
    await page.getByRole('button', { name: /Guardar|Confirmar/i }).click()

    // Register the platform credential.
    await page.getByRole('button', { name: /Activar biometría/i }).click()
    await expect(page.getByText(/Biometría activada/i)).toBeVisible()

    // Reload to engage the lock. LockScreen auto-prompts biometrics on mount;
    // the virtual authenticator auto-approves UV, so the overlay should dismiss
    // without typing a PIN and the home total renders.
    await page.goto('/')
    await page.reload()
    await expect(page.getByTestId('month-total')).toBeVisible({ timeout: 10_000 })
  })
})
