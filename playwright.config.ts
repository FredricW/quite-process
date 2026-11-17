import { defineConfig } from '@playwright/test';

const chrome = process.env.CHROME_PATH || '/usr/bin/google-chrome';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4173', launchOptions: { executablePath: chrome } },
  webServer: { command: 'npx vite preview --port 4173 --strictPort', port: 4173, reuseExistingServer: true },
  projects: [
    { name: 'phone', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
  ],
});
