import { test, expect, type Page } from '@playwright/test'

// Click-test the EPOS → retail price sync: log in, upload the real EPOS product
// export, and confirm the results page renders (applied / review / unmatched)
// without error. Proves the /sync/prices upload path end-to-end through the UI.

const EMAIL = 'test@freshandfruity.co.uk'
const PASSWORD = 'PlaywrightTest!234'
const PRICE_FILE = '/root/fresh/epos_full.csv'

async function login(page: Page) {
  await page.goto('/login')
  await page.fill('#email', EMAIL)
  await page.fill('#password', PASSWORD)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL('http://localhost:3100/')
}

test('EPOS price sync: upload export, results render', async ({ page }) => {
  await login(page)

  await page.goto('/sync/prices')
  await expect(page.getByRole('heading', { name: 'Import prices from EPOS' })).toBeVisible()

  // Upload the real EPOS product export and submit.
  await page.setInputFiles('input[type="file"]', PRICE_FILE)
  await page.getByRole('button', { name: 'Sync prices' }).click()

  // Redirects to the results view (?run=<uuid>); no error banner.
  await page.waitForURL(/\/sync\/prices\?run=/)
  await expect(page.locator('text=/Import failed|No file uploaded|check file format/')).toHaveCount(0)

  // The four summary stats render.
  for (const label of ['Applied', 'Review', 'No change', 'Unmatched']) {
    await expect(page.getByText(label, { exact: true })).toBeVisible()
  }

  // The unit-mismatch guard surfaces a real held item (Medjool or Apricot).
  await expect(page.getByText(/Held for review/)).toBeVisible()
  await expect(page.getByText(/Medjool|Apricot|Peach/).first()).toBeVisible()
})
