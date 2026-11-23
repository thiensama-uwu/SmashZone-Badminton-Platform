const { createLogger } = require("../../../shared/lib/logger");

module.exports = {
  serviceName: "notification-service",
  port: Number(process.env.PORT || 3006),
  jwtSecret: process.env.JWT_SECRET || "dev-access-secret",
  amqpUrl: process.env.AMQP_URL || "amqp://localhost:5672",
  logger: createLogger("notification-service"),
};
