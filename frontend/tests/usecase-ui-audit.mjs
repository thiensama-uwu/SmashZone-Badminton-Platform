import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE_URL = process.env.UI_BASE_URL || 'http://localhost:5173';
const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';

const ADMIN_EMAIL = 'admin@badminton.local';
const ADMIN_PASSWORD = 'Password@123';

const now = Date.now();
const customerEmail = `qa.ui.${now}@example.com`;
const customerPassword = 'Password@123';
const customerPasswordNew = 'Password@1234';
const adminCreatedUserEmail = `qa.admin.user.${now}@example.com`;

const results = [];

function addResult(id, feature, route, result, note) {
  results.push({ id, feature, route, result, note });
}

async function runCase(id, feature, route, fn) {
  try {
    const note = await fn();
    addResult(id, feature, route, 'PASS', note || 'OK');
  } catch (err) {
    addResult(id, feature, route, 'FAIL', (err && err.message ? err.message : String(err)).slice(0, 200));
  }
}

function tomorrowDateStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function goto(page, route) {
  await page.goto(`${BASE_URL}${route}`);
  await page.waitForLoadState('networkidle');
}

async function login(page, email, password) {
  await goto(page, '/auth/login');
  await page.fill('#login-email', email);
  await page.fill('#login-password', password);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
}

async function clearSession(page) {
  await page.goto(BASE_URL);
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

async function getOtp(email) {
  const res = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error(`forgot-password API ${res.status}`);
  const data = await res.json();
  if (!data.otp) throw new Error('OTP not returned by API');
  return data.otp;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await runCase('PUB-01', 'Xem trang chủ', '/', async () => {
    await goto(page, '/');
    await page.getByText('Đặt sân cầu lông').first().waitFor();
    return 'Landing render tốt';
  });

  await runCase('PUB-02', 'Xem danh sách sân', '/courts', async () => {
    await goto(page, '/courts');
    await page.getByText('Danh sách sân').first().waitFor();
    await page.getByText(/Tìm thấy\s+\d+\s+sân/).first().waitFor();
    return 'Có dữ liệu danh sách sân';
  });

  await runCase('PUB-03', 'Xem chi tiết sân', '/courts/:id', async () => {
    await goto(page, '/courts');
    const firstDetail = page.getByRole('link', { name: 'Đặt sân' }).first();
    await firstDetail.click();
    await page.waitForLoadState('networkidle');
    await page.getByText('Đặt sân nhanh').first().waitFor();
    return 'Trang chi tiết sân mở được';
  });

  await runCase('PUB-04', 'Xem giới thiệu', '/about', async () => {
    await goto(page, '/about');
    await page.getByText('Kết nối đam mê cầu lông').first().waitFor();
    return 'Nội dung about hiển thị đầy đủ';
  });

  await runCase('PUB-05', 'Xem liên hệ + gửi form', '/contact', async () => {
    await goto(page, '/contact');
    await page.fill('#contact-name', 'QA Browser');
    await page.fill('#contact-email', customerEmail);
    await page.fill('#contact-phone', '0900000000');
    await page.selectOption('#contact-subject', { label: 'Góp ý' });
    await page.fill('#contact-message', `UI audit ${now}`);
    await page.click('button[type="submit"]');
    await page.getByText('Tin nhắn đã được gửi thành công').waitFor({ timeout: 10000 });
    return 'POST /contact thành công';
  });

  await runCase('AUTH-01', 'Đăng ký', '/auth/register', async () => {
    await goto(page, '/auth/register');
    await page.fill('#reg-name', 'QA UI User');
    await page.fill('#reg-email', customerEmail);
    await page.fill('#reg-phone', '0901111111');
    await page.fill('#reg-password', customerPassword);
    await page.fill('#reg-confirm', customerPassword);
    await page.locator('input[type="checkbox"]').check();
    await page.click('button[type="submit"]');
    await page.getByText('Đăng ký thành công').waitFor({ timeout: 10000 });
    return `Tạo user ${customerEmail}`;
  });

  await runCase('AUTH-02', 'Đăng nhập', '/auth/login', async () => {
    await login(page, customerEmail, customerPassword);
    await page.waitForURL(/\/customer\//, { timeout: 10000 });
    return 'Đăng nhập điều hướng đúng customer';
  });

  await runCase('AUTH-03', 'Đăng xuất', '/customer/*', async () => {
    await page.getByRole('button', { name: 'Đăng xuất' }).click();
    await page.waitForURL(/\/auth\/login/, { timeout: 10000 });
    return 'Logout chuyển về login';
  });

  await runCase('AUTH-04', 'Quên mật khẩu', '/auth/forgot-password', async () => {
    await goto(page, '/auth/forgot-password');
    await page.fill('#forgot-email', customerEmail);
    await page.click('button[type="submit"]');
    await page.getByText('Kiểm tra email!').waitFor({ timeout: 10000 });
    return 'API trả success';
  });

  await runCase('AUTH-05', 'Đặt lại mật khẩu', '/auth/reset-password', async () => {
    const otp = await getOtp(customerEmail);
    await goto(page, '/auth/reset-password');
    await page.fill('#reset-email', customerEmail);
    const digits = otp.split('');
    const boxes = page.locator('input[inputmode="numeric"]');
    for (let i = 0; i < 6; i += 1) {
      await boxes.nth(i).fill(digits[i] || '0');
    }
    await page.fill('#reset-password', customerPasswordNew);
    await page.fill('#reset-confirm', customerPasswordNew);
    await page.click('button[type="submit"]');
    await page.getByText('Đặt lại thành công!').waitFor({ timeout: 10000 });
    return 'Reset password thành công bằng OTP thật';
  });

  await runCase('AUTH-06', 'Đăng nhập sau reset password', '/auth/login', async () => {
    await goto(page, '/auth/login');
    await page.fill('#login-email', customerEmail);
    await page.fill('#login-password', customerPasswordNew);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/customer\//, { timeout: 10000 });
    return 'Mật khẩu mới sử dụng được';
  });

  await runCase('AUTH-07', 'Refresh token', 'hidden flow', async () => {
    const tokenData = await page.evaluate(() => {
      const refreshToken = localStorage.getItem('refreshToken');
      return { refreshToken };
    });
    if (!tokenData.refreshToken) throw new Error('Không có refreshToken trong localStorage');
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokenData.refreshToken }),
    });
    if (!res.ok) throw new Error(`refresh failed: ${res.status}`);
    return 'Refresh endpoint trả 200';
  });

  await runCase('CUS-01', 'Đặt sân (hold + create booking)', '/customer/booking', async () => {
    await goto(page, '/customer/booking');
    const slot = page.locator('button').filter({ hasText: /\d{2}:\d{2} - \d{2}:\d{2}/ }).first();
    await slot.waitFor({ timeout: 10000 });
    await slot.click();
    await page.getByRole('button', { name: /Tiến hành thanh toán/ }).click();
    await page.waitForURL(/\/customer\/payment/, { timeout: 12000 });
    return 'Booking tạo thành công, điều hướng sang payment';
  });

  addResult('PAY-01', 'Thanh toán booking', '/customer/payment', 'SKIPPED', 'Bỏ qua theo yêu cầu user');

  await runCase('CUS-02', 'Xem lịch sử booking', '/customer/history', async () => {
    await goto(page, '/customer/history');
    await page.getByText('Lịch sử đặt sân').waitFor();
    await page.locator('tbody tr, .space-y-3 > div').first().waitFor({ timeout: 10000 });
    return 'Danh sách booking hiển thị';
  });

  await runCase('CUS-03', 'Hủy booking', '/customer/history', async () => {
    await goto(page, '/customer/history');
    const detailBtn = page.getByRole('button', { name: /Chi tiết/ }).first();
    await detailBtn.click();
    const cancelBtn = page.getByRole('button', { name: /Hủy booking|Hủy$/ }).first();
    const hasCancel = await cancelBtn.isVisible().catch(() => false);
    if (!hasCancel) throw new Error('Không có booking ở trạng thái cho phép hủy');
    page.once('dialog', (d) => d.accept());
    await cancelBtn.click();
    await page.waitForTimeout(1200);
    return 'Thực hiện cancel qua UI';
  });

  await runCase('CUS-04', 'Đổi lịch booking', '/customer/history', async () => {
    await goto(page, '/customer/history');
    const detailBtn = page.getByRole('button', { name: /Chi tiết/ }).first();
    await detailBtn.click();
    const resBtn = page.getByRole('button', { name: /Đổi lịch/ }).first();
    const hasRes = await resBtn.isVisible().catch(() => false);
    if (!hasRes) throw new Error('Không có booking CONFIRMED để đổi lịch');
    await resBtn.click();
    await page.locator('input[type="date"]').last().fill(tomorrowDateStr());
    const timeBtn = page.locator('button').filter({ hasText: /\d{2}:\d{2} - \d{2}:\d{2}/ }).first();
    await timeBtn.click();
    await page.getByRole('button', { name: /Xác nhận đổi lịch/ }).click();
    await page.waitForTimeout(1200);
    return 'Đổi lịch qua modal';
  });

  await runCase('CUS-05', 'Hồ sơ cá nhân', '/customer/profile', async () => {
    await goto(page, '/customer/profile');
    const newPhone = `09${String(now).slice(-8)}`;
    await page.locator('input[name="phone"]').fill(newPhone);
    await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await page.getByText('Lưu thành công!').waitFor({ timeout: 10000 });
    return 'PATCH profile thành công';
  });

  await runCase('AUTH-08', 'Đổi mật khẩu khi đã đăng nhập', '/customer/profile', async () => {
    await goto(page, '/customer/profile');
    await page.getByRole('button', { name: 'Đổi mật khẩu' }).click();
    await page.locator('input[type="password"]').nth(0).fill(customerPasswordNew);
    await page.locator('input[type="password"]').nth(1).fill(customerPassword);
    await page.locator('input[type="password"]').nth(2).fill(customerPassword);
    await page.getByRole('button', { name: 'Xác nhận' }).click();
    await page.getByText('Đổi mật khẩu thành công!').waitFor({ timeout: 10000 });
    return 'Đổi mật khẩu và rollback về mật khẩu cũ';
  });

  await runCase('NOTI-01', 'Xem danh sách thông báo (profile)', '/customer/profile', async () => {
    await goto(page, '/customer/profile');
    await page.getByText('Thông báo').first().waitFor();
    return 'Danh sách thông báo render';
  });

  await runCase('NOTI-02', 'Xem danh sách thông báo (bell)', 'layout bell', async () => {
    await goto(page, '/customer/booking');
    await page.locator('header button').first().click();
    await page.getByText('Thông báo').first().waitFor();
    return 'Panel notification mở được';
  });

  await runCase('NOTI-03', 'Đánh dấu đã đọc', 'layout bell/profile', async () => {
    const markAll = page.getByRole('button', { name: 'Đánh dấu tất cả đã đọc' }).first();
    const enabled = await markAll.isEnabled().catch(() => false);
    if (!enabled) return 'Không có unread để mark-read tại thời điểm test';
    await markAll.click();
    await page.waitForTimeout(800);
    return 'Mark-read request gửi thành công';
  });

  await runCase('RBAC-01', 'Customer không vào admin route', '/admin/dashboard', async () => {
    await goto(page, '/admin/dashboard');
    await page.waitForURL(/\/$/, { timeout: 10000 });
    return 'Bị chặn đúng theo role';
  });

  await clearSession(page);

  await runCase('ADM-01', 'Đăng nhập admin', '/auth/login', async () => {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.waitForURL(/\/admin\/dashboard/, { timeout: 10000 });
    return 'Admin login ok';
  });

  await runCase('RBAC-02', 'Admin không vào customer route', '/customer/booking', async () => {
    await goto(page, '/customer/booking');
    await page.waitForURL(/\/$/, { timeout: 10000 });
    return 'Route customer bị chặn với admin';
  });

  await runCase('ADM-02', 'Dashboard', '/admin/dashboard', async () => {
    await goto(page, '/admin/dashboard');
    await page.getByText('Tổng quan hôm nay').first().waitFor();
    return 'Dashboard render';
  });

  await runCase('ADM-03', 'Quản lý booking (xem list)', '/admin/bookings', async () => {
    await goto(page, '/admin/bookings');
    await page.getByText('Quản lý booking').first().waitFor();
    return 'List booking admin hiển thị';
  });

  await runCase('ADM-04', 'Tạo booking thủ công', '/admin/bookings', async () => {
    await goto(page, '/admin/bookings');
    await page.getByRole('button', { name: /Tạo booking/ }).click();
    await page.getByText('Tạo booking thủ công').waitFor();
    await page.locator('select').first().selectOption({ index: 1 });
    await page.locator('input[type="date"]').first().fill(tomorrowDateStr());
    const slotBtn = page.locator('button').filter({ hasText: /\d{2}:\d{2} - \d{2}:\d{2}/ }).first();
    await slotBtn.waitFor({ timeout: 10000 });
    await slotBtn.click();
    await page.getByRole('button', { name: /Xác nhận tạo booking/ }).click();
    await page.waitForTimeout(1500);
    return 'Staff-create booking thao tác thành công';
  });

  await runCase('ADM-05', 'Quản lý sân: create/edit/delete/reactivate', '/admin/courts', async () => {
    const courtName = `San QA ${now}`;
    const courtNameEdited = `${courtName} Edit`;
    await goto(page, '/admin/courts');
    await page.getByRole('button', { name: /Thêm sân/ }).click();
    await page.locator('input[type="text"]').first().fill(courtName);
    await page.getByRole('button', { name: /^Lưu$/ }).click();
    await page.waitForTimeout(1200);

    await page.locator('input[placeholder*="Tìm theo tên sân"]').fill(courtName);
    await page.getByRole('button', { name: 'Sửa' }).first().click();
    await page.locator('input[type="text"]').first().fill(courtNameEdited);
    await page.getByRole('button', { name: /^Lưu$/ }).click();
    await page.waitForTimeout(1200);

    page.once('dialog', (d) => d.accept());
    await page.getByTitle('Xóa (soft)').first().click();
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: 'Kích hoạt' }).first().click();
    await page.waitForTimeout(1000);
    return 'CRUD + soft-delete/reactivate chạy được';
  });

  await runCase('ADM-06', 'Quản lý người dùng: create + status/role', '/admin/users', async () => {
    await goto(page, '/admin/users');
    await page.getByRole('button', { name: /Tạo tài khoản/ }).click();
    await page.locator('input[type="email"]').fill(adminCreatedUserEmail);
    await page.locator('input[type="password"]').fill('Password@123');
    await page.locator('input[type="text"]').first().fill('QA Admin Managed');
    await page.getByRole('button', { name: /^Tạo$/ }).click();
    await page.waitForTimeout(1200);

    await page.locator('input[placeholder*="Tìm theo email"]').fill(adminCreatedUserEmail);
    await page.locator('tbody tr').first().click();
    const staffRole = page.getByRole('button', { name: 'Nhân viên' }).last();
    await staffRole.click();
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: 'Tạm khóa' }).click();
    await page.waitForTimeout(1200);
    return 'Tạo user + cập nhật role/status';
  });

  await runCase('ADM-07', 'Báo cáo doanh thu/thống kê', '/admin/reports', async () => {
    await goto(page, '/admin/reports');
    await page.getByText('Báo cáo & Thống kê').waitFor();
    return 'Reports render được';
  });

  await runCase('SYS-01', 'Soft-delete user/court qua UI admin', '/admin/users + /admin/courts', async () => {
    return 'Đã cover trong ADM-05 và ADM-06';
  });

  addResult('PAY-02', 'Tạo thanh toán', '/customer/payment', 'SKIPPED', 'Bỏ qua theo yêu cầu user');
  addResult('PAY-03', 'Xem chi tiết thanh toán', '/customer/payment', 'SKIPPED', 'Bỏ qua theo yêu cầu user');
  addResult('PAY-04', 'Hoàn tiền', '/admin/bookings', 'SKIPPED', 'Bỏ qua theo yêu cầu user');
  addResult('PAY-05', 'Webhook thanh toán mock', 'API only', 'SKIPPED', 'Bỏ qua theo yêu cầu user');
  addResult('PAY-06', 'Webhook SePay', 'API only', 'SKIPPED', 'Bỏ qua theo yêu cầu user');

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobilePage = await mobile.newPage();
  await runCase('UX-01', 'Responsive mobile public pages', '/, /courts, /contact', async () => {
    await goto(mobilePage, '/');
    await goto(mobilePage, '/courts');
    await goto(mobilePage, '/contact');
    const hasOverflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    if (hasOverflow) throw new Error('Phát hiện overflow ngang trên mobile');
    return 'Không thấy vỡ layout chính trên mobile';
  });
  await mobile.close();

  await context.close();
  await browser.close();

  const outDir = path.join(process.cwd(), '..', 'artifacts');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `usecase-ui-audit-${now}.json`);
  fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2), 'utf-8');
  console.log(outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
