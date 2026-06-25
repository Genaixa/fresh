import { test, expect, type Page } from '@playwright/test'

// End-of-day: float in, ring a sale, close the day, and the Z report appears
// with a balanced cash-up. Money-critical close path, exercised through the UI.
//
// Needs the known test-account password (see till-offline.spec.ts).

const EMAIL = 'test@freshandfruity.co.uk'
const PASSWORD = 'PlaywrightTest!234'

async function login(page: Page) {
  await page.goto('/login')
  await page.fill('#email', EMAIL)
  await page.fill('#password', PASSWORD)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL('http://localhost:3100/')
}

test('end of day: float, sale, close, balanced Z report', async ({ page }) => {
  await login(page)

  // Add a £20 opening float.
  await page.goto('/till/eod')
  await page.getByRole('button', { name: 'Add float' }).click()
  await page.getByPlaceholder('0.00').fill('20')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Expected in drawer')).toBeVisible()

  // Ring a card sale (doesn't touch the cash drawer).
  await page.goto('/till')
  await page.getByTestId('till-product').filter({ hasNotText: '/kg' }).first().click()
  await page.getByTestId('pay-card').click()
  await page.getByTestId('card-confirm').click()
  await expect(page.getByTestId('sync-status')).toHaveAttribute('data-state', 'synced', { timeout: 15_000 })

  // Close the day: count £20 (= float, no cash sales) → should balance.
  await page.goto('/till/eod')
  await page.getByRole('button', { name: 'Close Day (Z)' }).click()
  await page.getByPlaceholder('counted cash £').fill('20')
  await expect(page.getByText('Balances')).toBeVisible()
  await page.getByRole('button', { name: 'Confirm Z' }).click()

  // A Z report now appears, and the open period has reset (no sales to close).
  await expect(page.getByText(/^Z\d+$/).first()).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'Close Day (Z)' })).toBeDisabled()
})
