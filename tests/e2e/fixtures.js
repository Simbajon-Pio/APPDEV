import { test as base, expect } from '@playwright/test';

export const origin = 'http://127.0.0.1:5173';
const password = process.env.DEMO_PASSWORD || 'DemoOnly!2026';

export const test = base.extend({
  staffSession: [async ({ playwright }, use) => {
    const context = await playwright.request.newContext({ baseURL: origin });
    let session;
    try {
      const bootstrap = await context.get('/api/auth/csrf');
      expect(bootstrap.status()).toBe(200);
      const token = (await bootstrap.json()).data.csrf_token;
      const login = await context.post('/api/auth/login', {
        headers: { Origin: origin, 'X-CSRF-Token': token },
        data: { username: 'demo_a', password },
      });
      expect(login.status()).toBe(200);
      const csrfToken = (await login.json()).data.csrf_token;
      session = { storageState: await context.storageState(), csrfToken };
    } finally {
      await context.dispose();
    }
    await use(session);
  }, { scope: 'worker' }],
  authenticatedRequest: async ({ playwright, staffSession }, use) => {
    const context = await playwright.request.newContext({
      baseURL: origin,
      storageState: staffSession.storageState,
    });
    try {
      await use({ context, token: staffSession.csrfToken });
    } finally {
      await context.dispose();
    }
  },
});

export { expect };
