const { createLogger } = require("../../../shared/lib/logger");

module.exports = {
  serviceName: "user-service",
  port: Number(process.env.PORT || 3002),
  jwtSecret: process.env.JWT_SECRET || "dev-access-secret",
  internalServiceToken: process.env.INTERNAL_SERVICE_TOKEN || "local-internal-token",
  logger: createLogger("user-service"),
};
