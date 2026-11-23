const { createLogger } = require("../../../shared/lib/logger");

module.exports = {
  serviceName: "api-gateway",
  port: Number(process.env.PORT || 3000),
  jwtSecret: process.env.JWT_SECRET || "dev-access-secret",
  authServiceUrl: process.env.AUTH_SERVICE_URL || "http://localhost:3001",
  userServiceUrl: process.env.USER_SERVICE_URL || "http://localhost:3002",
  courtServiceUrl: process.env.COURT_SERVICE_URL || "http://localhost:3003",
  bookingServiceUrl: process.env.BOOKING_SERVICE_URL || "http://localhost:3004",
  paymentServiceUrl: process.env.PAYMENT_SERVICE_URL || "http://localhost:3005",
  notificationServiceUrl: process.env.NOTIFICATION_SERVICE_URL || "http://localhost:3006",
  reportServiceUrl: process.env.REPORT_SERVICE_URL || "http://localhost:3007",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  redisPrefix: process.env.REDIS_PREFIX || "cnm",
  logger: createLogger("api-gateway"),
};
