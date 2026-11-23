import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5174';
const OUT_DIR = path.resolve('docs/screenshots');
fs.mkdirSync(OUT_DIR, { recursive: true });

let counter = 0;
async function shot(page, name) {
  counter += 1;
  const fname = `${String(counter).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: path.join(OUT_DIR, fname), fullPage: true });
  console.log('Saved', fname);
}

async function goto(page, url) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000); // SplashScreen shows for a fixed 4s + fade on every fresh load
}

async function login(page, identifier, password) {
  await goto(page, `${BASE_URL}/auth/login`);
  await page.fill('#login-identifier', identifier);
  await page.fill('#login-password', password);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // ---- Public / Home ----
  await goto(page, BASE_URL);
  await shot(page, 'home');

  await goto(page, `${BASE_URL}/courts`);
  await shot(page, 'courts-list');

  try {
    const firstCourtLink = page.locator('a[href^="/courts/"]').first();
    if (await firstCourtLink.count()) {
      await firstCourtLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);
      await shot(page, 'court-detail');
    }
  } catch (e) {
    console.log('court detail skip:', e.message);
  }

  await goto(page, `${BASE_URL}/auth/login`);
  await shot(page, 'login-page');

  await goto(page, `${BASE_URL}/auth/register`);
  await shot(page, 'register-page');

  // ---- Player (customer) flow ----
  // No seeded customer account exists; register a fresh demo player.
  const demoEmail = `demo.player.${Date.now()}@example.com`;
  const demoPhone = `09${String(Date.now()).slice(-8)}`;
  const demoPassword = 'Password@123';
  try {
    const fillIfExists = async (selector, value) => {
      const el = page.locator(selector);
      if (await el.count()) await el.fill(value);
    };
    await fillIfExists('input[name="name"]', 'Nguyen Van Demo');
    await fillIfExists('input[name="email"]', demoEmail);
    await fillIfExists('input[name="phone"]', demoPhone);
    await fillIfExists('input[name="password"]', demoPassword);
    await fillIfExists('input[name="confirmPassword"]', demoPassword);
    const agreeCheckbox = page.locator('input[type="checkbox"]');
    if (await agreeCheckbox.count()) await agreeCheckbox.check();
    await shot(page, 'register-filled');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    await shot(page, 'after-register');
    const errorBox = page.locator('.text-error, .bg-red-50');
    if (await errorBox.count()) {
      const msg = await errorBox.first().innerText();
      throw new Error(`Register did not succeed: ${msg}`);
    }
  } catch (e) {
    console.error('register flow failed:', e.message);
    throw e;
  }

  await login(page, demoEmail, demoPassword);
  await shot(page, 'player-home-loggedin');

  await goto(page, `${BASE_URL}/customer/booking`);
  await shot(page, 'player-booking');

  await goto(page, `${BASE_URL}/customer/history`);
  await shot(page, 'player-history');

  await goto(page, `${BASE_URL}/customer/profile`);
  await shot(page, 'player-profile');

  // logout (best effort) by clearing storage
  await context.clearCookies();
  await page.evaluate(() => localStorage.clear());

  // ---- Admin flow ----
  await login(page, 'admin@badminton.local', 'Password@123');
  await shot(page, 'admin-dashboard');

  await goto(page, `${BASE_URL}/admin/courts`);
  await shot(page, 'admin-courts');

  await goto(page, `${BASE_URL}/admin/bookings`);
  await shot(page, 'admin-bookings');

  await goto(page, `${BASE_URL}/admin/users`);
  await shot(page, 'admin-users');

  await goto(page, `${BASE_URL}/admin/reports`);
  await shot(page, 'admin-reports');

  await goto(page, `${BASE_URL}/admin/profile`);
  await shot(page, 'admin-profile');

  await browser.close();
  console.log('DONE. Screenshots in', OUT_DIR);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
