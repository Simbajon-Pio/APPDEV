import { defineConfig } from '@playwright/test';

const appOrigin = 'http://127.0.0.1:5173';
const apiOrigin = 'http://127.0.0.1:5000';
const testDatabase = {
  host: '127.0.0.1',
  name: 'ebarangaymo_test',
};
const demoPassword = 'DemoOnly!2026';

process.env.DEMO_PASSWORD = demoPassword;

if (process.env.E2E_BASE_URL && process.env.E2E_BASE_URL !== appOrigin) {
  throw new Error(`E2E_BASE_URL is fixed to the isolated local server at ${appOrigin}`);
}

if (!['localhost', '127.0.0.1', '::1'].includes(testDatabase.host)) {
  throw new Error('Playwright E2E database host must use loopback');
}
if (!/(^|[_-])test($|[_-])/i.test(testDatabase.name)) {
  throw new Error('Playwright E2E database name must identify a test database');
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  webServer: [
    {
      command: 'npm run dev:api',
      url: `${apiOrigin}/api/auth/csrf`,
      env: {
        DB_HOST: testDatabase.host,
        DB_PORT: '3307',
        DB_NAME: testDatabase.name,
        TEST_DB_NAME: testDatabase.name,
        DB_USER: 'ebarangaymo',
        DB_PASSWORD: 'local-demo-only',
        NODE_ENV: 'test',
        APP_ORIGIN: appOrigin,
        PUBLIC_APP_URL: appOrigin,
        SESSION_SECRET: 'e2e-only-synthetic-session-secret',
        DEMO_PASSWORD: demoPassword,
        HOST: '127.0.0.1',
        PORT: '5000',
      },
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: 'npm --prefix apps/web run dev -- --host 127.0.0.1 --port 5173 --strictPort',
      url: appOrigin,
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
  use: {
    channel: 'chromium',
    baseURL: appOrigin,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
