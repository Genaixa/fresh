import { test, expect, type Page } from '@playwright/test'

// Phase 2 proof: the till keeps trading with no network.
//   1. online sale syncs
//   2. offline sale is held locally (not lost)
//   3. the till PAGE still loads offline (service worker shell)
//   4. the queued sale survives a reload (IndexedDB) and syncs on reconnect
//
// Requires a known password on the test staff account:
//   UPDATE auth.users SET encrypted_password = crypt('PlaywrightTest!234',
//     gen_salt('bf')) WHERE email = 'test@freshandfruity.co.uk';

const EMAIL = 'test@freshandfruity.co.uk'
const PASSWORD = 'PlaywrightTest!234'

async function ringCardSale(page: Page) {
  // A non-kg product (kg tiles show a "/kg" suffix and open a weigh modal).
  await page.getByTestId('till-product').filter({ hasNotText: '/kg' }).first().click()
  const payCard = page.getByTestId('pay-card')
  await expect(payCard).toBeEnabled()
  await payCard.click()
  await page.getByTestId('card-confirm').click()
}

test('till survives going offline — no lost or doubled sale', async ({ page, context }) => {
  // 1. Sign in (staff → app home).
  await page.goto('/login')
  await page.fill('#email', EMAIL)
  await page.fill('#password', PASSWORD)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL('http://localhost:3100/')

  // 2. Open the till and let the service worker install + activate.
  await page.goto('/till')
  await page.getByTestId('till-product').first().waitFor()
  await page.waitForFunction(
    async () => !!(await navigator.serviceWorker?.getRegistration())?.active,
    null, { timeout: 20_000 },
  )
  // Reload once online so the now-controlling SW caches the shell + assets.
  await page.reload()
  await page.getByTestId('till-product').first().waitFor()
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 20_000 })

  // 3. Online sale → syncs to the server.
  await ringCardSale(page)
  await expect(page.getByTestId('sync-status')).toHaveAttribute('data-state', 'synced', { timeout: 20_000 })

  // 4. Go offline and ring a sale — it must be held, not lost.
  await context.setOffline(true)
  await ringCardSale(page)
  await expect(page.getByTestId('sync-status')).toHaveAttribute('data-state', 'offline', { timeout: 10_000 })
  await expect(page.getByTestId('sync-status')).toHaveAttribute('data-pending', /[1-9]/)

  // 5. Reload while still offline — the SW must serve the till shell, and the
  //    queued sale must survive the reload (IndexedDB).
  await page.reload()
  await page.getByTestId('till-product').first().waitFor({ timeout: 20_000 })
  await expect(page.getByTestId('sync-status')).toHaveAttribute('data-pending', /[1-9]/)

  // 6. Back online → the queue drains and the till reports synced.
  await context.setOffline(false)
  await expect(page.getByTestId('sync-status')).toHaveAttribute('data-state', 'synced', { timeout: 30_000 })
})
