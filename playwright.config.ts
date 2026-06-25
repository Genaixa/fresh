import { defineConfig } from '@playwright/test'

// E2E against the running pm2 server (production build — the SW only registers
// in production). Start it with: npm run build && pm2 restart fresh-and-fruity
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3100',
    headless: true,
    browserName: 'chromium',
    serviceWorkers: 'allow',
  },
})
