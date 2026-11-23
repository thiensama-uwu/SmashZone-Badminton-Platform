import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5173';
const API_BASE = 'http://localhost:3000';
const HEADED = process.env.HEADED === '1';

const ADMIN_EMAIL = 'admin@badminton.local';
const ADMIN_PASSWORD = 'Password@123';

const now = Date.now();
const stamp = new Date().toISOString();
const out = [];

function log(id, before, after, note) {
  out.push({ id, before, after, note });
}

async function testCase(id, before, fn) {
  try {
    const note = await fn();
    log(id, before, 'PASS', note || 'OK');
  } catch (e) {
    log(id, before, 'FAIL', (e?.message || String(e)).slice(0, 220));
  }
}

async function login(page, email, password) {
  await page.goto(`${BASE_URL}/auth/login`);
  await page.fill('#login-email', email);
  await page.fill('#login-password', password);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
}

async function main() {
  const browser = await chromium.launch({ headless: !HEADED, slowMo: HEADED ? 250 : 0 });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();

  await testCase('PUB-03', 'FAIL', async () => {
    await page.goto(`${BASE_URL}/courts/court_viettel`);
    await page.getByText('Đặt sân nhanh').first().waitFor({ timeout: 15000 });
    return 'Court detail render ổn';
  });

  await testCase('AUTH-07', 'FAIL', async () => {
    const email = `qa.refresh.rerun.${Date.now()}@example.com`;
    await fetch(`${API_BASE}/auth/register`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'Password@123', fullName: 'QA Refresh ReRun' }),
    });
    await login(page, email, 'Password@123');
    await page.waitForURL(/\/customer\//, { timeout: 15000 });
    const rt = await page.evaluate(() => localStorage.getItem('cb_refresh_token'));
    if (!rt) throw new Error('Không có cb_refresh_token');
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    });
    if (!res.ok) throw new Error(`refresh ${res.status}`);
    return 'Refresh 200 với key storage đúng';
  });

  await testCase('CUS-02', 'FAIL', async () => {
    await page.goto(`${BASE_URL}/customer/history`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('heading', { name: 'Lịch sử đặt sân' }).waitFor({ timeout: 15000 });
    return 'Trang history render đúng';
  });

  await testCase('RBAC-02', 'FAIL', async () => {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.waitForURL('**/admin/dashboard', { timeout: 20000 });
    await page.goto(`${BASE_URL}/customer/booking`);
    await page.waitForLoadState('networkidle');
    const url = page.url();
    if (url.includes('/customer/booking')) throw new Error('Admin vẫn vào được customer route');
    return `Admin bị chặn, URL hiện tại: ${url}`;
  });

  await testCase('ADM-02', 'FAIL', async () => {
    await page.goto(`${BASE_URL}/admin/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('heading', { name: 'Dashboard' }).waitFor({ timeout: 15000 });
    return 'Dashboard heading đúng';
  });

  await testCase('ADM-04', 'FAIL', async () => {
    await page.goto(`${BASE_URL}/admin/bookings`);
    await page.getByRole('button', { name: /Tạo booking/ }).click();
    await page.getByText('Tạo booking thủ công').waitFor();
    await page.locator('div.fixed select').first().selectOption({ index: 1 });
    const d = new Date();
    d.setDate(d.getDate() + 2);
    const date = d.toISOString().slice(0, 10);
    await page.locator('div.fixed input[type="date"]').first().fill(date);
    const slot = page.locator('div.fixed button').filter({ hasText: /\d{2}:\d{2} - \d{2}:\d{2}/ }).first();
    await slot.waitFor({ timeout: 15000 });
    return 'Modal lấy được slot trống';
  });

  log('CUS-04', 'FAIL', 'BLOCKED', 'Không re-run vì thiếu dữ liệu CONFIRMED khi bỏ thanh toán theo yêu cầu');

  await ctx.close();
  await browser.close();

  const outPath = path.join(process.cwd(), '..', 'artifacts', `rerun-short-${now}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ generatedAt: stamp, headed: HEADED, results: out }, null, 2));
  console.log(outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
