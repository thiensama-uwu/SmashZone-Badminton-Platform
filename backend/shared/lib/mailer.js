const nodemailer = require("nodemailer");

let _transporter = null;

function createMailTransporter(config = {}) {
  const host = config.smtpHost || process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(config.smtpPort || process.env.SMTP_PORT || 587);
  const user = config.smtpUser || process.env.SMTP_USER || "";
  const pass = config.smtpPass || process.env.SMTP_PASS || "";

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

function getTransporter(config) {
  if (!_transporter) {
    _transporter = createMailTransporter(config);
  }
  return _transporter;
}

async function sendMail({ to, subject, text, html }, config) {
  const transporter = getTransporter(config);
  if (!transporter) {
    return { sent: false, reason: "SMTP not configured" };
  }

  const from = config?.smtpFrom || process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@SmashZone.vn";

  try {
    const info = await transporter.sendMail({ from, to, subject, text, html });
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    return { sent: false, reason: error.message };
  }
}

function buildOtpEmail(otp, email) {
  const subject = "Mã OTP đặt lại mật khẩu - SmashZone";
  const text = `Xin chào,\n\nMã OTP của bạn là: ${otp}\n\nMã này có hiệu lực trong 5 phút. Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.\n\nTrân trọng,\nSmashZone`;
  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; background: linear-gradient(135deg, #2563eb, #7c3aed); color: white; font-weight: bold; font-size: 20px; width: 48px; height: 48px; line-height: 48px; border-radius: 12px;">CB</div>
        <h2 style="margin: 12px 0 0; color: #1e293b;">SmashZone</h2>
      </div>
      <div style="background: #f8fafc; border-radius: 16px; padding: 24px; text-align: center; border: 1px solid #e2e8f0;">
        <p style="color: #64748b; margin: 0 0 16px; font-size: 14px;">Mã OTP đặt lại mật khẩu của bạn:</p>
        <div style="font-size: 36px; letter-spacing: 8px; font-weight: bold; color: #2563eb; margin: 8px 0; font-family: monospace;">${otp}</div>
        <p style="color: #94a3b8; font-size: 12px; margin: 16px 0 0;">Mã này có hiệu lực trong <strong>5 phút</strong>.</p>
      </div>
      <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 24px;">
        Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.
      </p>
    </div>
  `;
  return { to: email, subject, text, html };
}

module.exports = {
  sendMail,
  buildOtpEmail,
  createMailTransporter,
};

