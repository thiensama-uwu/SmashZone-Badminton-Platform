const { createLogger } = require("../../../shared/lib/logger");

module.exports = {
  serviceName: "booking-service",
  port: Number(process.env.PORT || 3004),
  jwtSecret: process.env.JWT_SECRET || "dev-access-secret",
  courtServiceUrl: process.env.COURT_SERVICE_URL || "http://localhost:3003",
  internalServiceToken: process.env.INTERNAL_SERVICE_TOKEN || "local-internal-token",
  amqpUrl: process.env.AMQP_URL || "amqp://localhost:5672",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  redisPrefix: process.env.REDIS_PREFIX || "cnm",
  holdTtlMs: Number(process.env.HOLD_TTL_MS || 10 * 60 * 1000),
  holdSweepIntervalMs: Number(process.env.HOLD_SWEEP_INTERVAL_MS || 60 * 1000),
  idempotencyTtlMs: Number(process.env.IDEMPOTENCY_TTL_MS || 600000),
  logger: createLogger("booking-service"),
};
