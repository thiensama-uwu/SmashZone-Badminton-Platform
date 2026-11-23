const { createLogger } = require("../../../shared/lib/logger");

module.exports = {
  serviceName: "auth-service",
  port: Number(process.env.PORT || 3001),
  jwtSecret: process.env.JWT_SECRET || "dev-access-secret",
  refreshSecret: process.env.REFRESH_SECRET || "dev-refresh-secret",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  internalServiceToken: process.env.INTERNAL_SERVICE_TOKEN || "local-internal-token",
  userServiceUrl: process.env.USER_SERVICE_URL || "http://localhost:3002",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  redisPrefix: process.env.REDIS_PREFIX || "cnm",
  amqpUrl: process.env.AMQP_URL || "amqp://localhost:5672",
  smtpHost: process.env.SMTP_HOST || "smtp.gmail.com",
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  smtpFrom: process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@SmashZone.vn",
  logger: createLogger("auth-service"),
};

