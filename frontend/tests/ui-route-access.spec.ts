import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';

type UiFailure = {
  route: string;
  status: number;
  url: string;
};

const ADMIN_EMAIL = 'admin@badminton.local';
const ADMIN_PASSWORD = 'Password@123';

const publicRoutes = ['/', '/courts', '/about', '/contact', '/auth/login', '/auth/register'];
const adminRoutes = ['/admin/dashboard', '/admin/courts', '/admin/bookings', '/admin/reports', '/admin/users'];
const customerRoutes = ['/customer/booking', '/customer/history', '/customer/profile'];

const allFailures: UiFailure[] = [];

async function login(page: any, email: string, password: string) {
  await page.goto('/auth/login');
  await page.fill('#login-email', email);
  await page.fill('#login-password', password);
  await page.click('button[type="submit"]');
}

test.describe('UI route and endpoint access', () => {
  test('public routes should render', async ({ page }) => {
    const failures: UiFailure[] = [];
    page.on('response', (resp) => {
      const u = resp.url();
      if (u.includes('/api/') && resp.status() >= 400) {
        failures.push({ route: page.url(), status: resp.status(), url: u });
      }
    });

    for (const route of publicRoutes) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('body')).toBeVisible();
    }

    allFailures.push(...failures);
  });

  test('admin routes should be accessible after admin login', async ({ page }) => {
    const failures: UiFailure[] = [];
    page.on('response', (resp) => {
      const u = resp.url();
      if (u.includes('/api/') && resp.status() >= 400) {
        failures.push({ route: page.url(), status: resp.status(), url: u });
      }
    });

    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.waitForURL(/\/admin\/dashboard|\/customer\/booking/);

    for (const route of adminRoutes) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(new RegExp(route.replace('/', '\\/')));
    }

    allFailures.push(...failures);
  });

  test('customer routes should be accessible after customer registration/login', async ({ page, request }) => {
    const failures: UiFailure[] = [];
    page.on('response', (resp) => {
      const u = resp.url();
      if (u.includes('/api/') && resp.status() >= 400) {
        failures.push({ route: page.url(), status: resp.status(), url: u });
      }
    });

    const guid = Date.now().toString();
    const email = `qa.browser.${guid}@example.com`;
    const password = 'Password@123';

    const res = await request.post('http://localhost:3000/auth/register', {
      data: { email, password, fullName: `QA Browser ${guid}` },
    });
    expect([200, 201]).toContain(res.status());

    await login(page, email, password);
    await page.waitForURL(/\/customer\//);

    for (const route of customerRoutes) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(new RegExp(route.replace('/', '\\/')));
    }

    allFailures.push(...failures);
  });
});

test.afterAll(async () => {
  const outDir = path.join(process.cwd(), '..', 'artifacts');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(outDir, `ui-access-report-${stamp}.json`);

  const report = {
    generatedAt: new Date().toISOString(),
    totalFailures: allFailures.length,
    failures: allFailures,
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
});
