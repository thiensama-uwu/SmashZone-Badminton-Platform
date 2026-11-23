const { createLogger } = require("../../../shared/lib/logger");

module.exports = {
  serviceName: "court-service",
  port: Number(process.env.PORT || 3003),
  jwtSecret: process.env.JWT_SECRET || "dev-access-secret",
  bookingServiceUrl: process.env.BOOKING_SERVICE_URL || "http://localhost:3004",
  internalServiceToken: process.env.INTERNAL_SERVICE_TOKEN || "local-internal-token",
  amqpUrl: process.env.AMQP_URL || "amqp://localhost:5672",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  redisPrefix: process.env.REDIS_PREFIX || "cnm",
  cacheTtlCourtsListMs: Number(process.env.CACHE_TTL_COURTS_LIST_MS || 30000),
  cacheTtlCourtDetailMs: Number(process.env.CACHE_TTL_COURT_DETAIL_MS || 300000),
  cacheTtlAvailabilityMs: Number(process.env.CACHE_TTL_AVAILABILITY_MS || 20000),
  logger: createLogger("court-service"),
};
