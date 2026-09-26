import { defineConfig, devices } from '@playwright/test';

// PW_CHROMIUM lets environments with a preinstalled browser (no download) run the suite.
const executablePath = process.env.PW_CHROMIUM || undefined;
// Firefox and WebKit (Safari's engine) run when PW_ALL_BROWSERS=1, as in CI.
const allBrowsers = process.env.PW_ALL_BROWSERS === '1';

// The suite asserts Russian labels; the interface otherwise follows the browser language.
const locale = 'ru-RU';

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:4173',
    locale,
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, locale, launchOptions: { executablePath } },
    },
    ...(allBrowsers
      ? [
          // The stress PDF check renders three large documents; one engine is enough for it.
          { name: 'firefox', testIgnore: /stress/, use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 }, locale } },
          { name: 'webkit', testIgnore: /stress/, use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 }, locale } },
        ]
      : []),
  ],
  webServer: {
    command: 'npm run dev -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
});
