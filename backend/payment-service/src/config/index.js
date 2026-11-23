const crypto = require("crypto");
const { createLogger } = require("../../../shared/lib/logger");

module.exports = {
  serviceName: "payment-service",
  port: Number(process.env.PORT || 3005),
  jwtSecret: process.env.JWT_SECRET || "dev-access-secret",
  webhookSecret: process.env.MOCK_WEBHOOK_SECRET || "mock-webhook-secret",
  amqpUrl: process.env.AMQP_URL || "amqp://localhost:5672",
  paymentTimeoutMs: Number(process.env.PAYMENT_TIMEOUT_MS || 120000),
  reconcileIntervalMs: Number(process.env.RECONCILE_INTERVAL_MS || 120000),
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  redisPrefix: process.env.REDIS_PREFIX || "cnm",
  idempotencyTtlMs: Number(process.env.IDEMPOTENCY_TTL_MS || 600000),
  logger: createLogger("payment-service"),

  paymentProvider: process.env.PAYMENT_PROVIDER || "sepay",
  sepayBankCode: process.env.SEPAY_BANK_CODE || "",
  sepayAccountNumber: process.env.SEPAY_ACCOUNT_NUMBER || "",
  sepayAccountName: process.env.SEPAY_ACCOUNT_NAME || "",
  sepayMerchantId: process.env.SEPAY_MERCHANT_ID || "",
  sepayMerchantSecret: process.env.SEPAY_MERCHANT_SECRET || "",
  sepayApiKey: process.env.SEPAY_API_KEY || "",
  sepayWebhookSecret: process.env.SEPAY_WEBHOOK_SECRET || "",

  signWebhook(payload) {
    return crypto.createHmac("sha256", process.env.MOCK_WEBHOOK_SECRET || "mock-webhook-secret").update(payload).digest("hex");
  },
};
