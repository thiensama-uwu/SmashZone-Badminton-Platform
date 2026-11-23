const { createLogger } = require("../../../shared/lib/logger");

module.exports = {
  serviceName: "report-service",
  port: Number(process.env.PORT || 3007),
  logger: createLogger("report-service"),
};
