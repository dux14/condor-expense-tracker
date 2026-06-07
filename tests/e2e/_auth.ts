import type { BrowserContext } from '@playwright/test';

export async function stubSession(context: BrowserContext) {
  await context.addCookies([
    { name: 'e2e-auth', value: '1', url: 'http://localhost:3100' },
  ]);
}
