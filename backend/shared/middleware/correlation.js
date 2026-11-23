const { createId } = require("../utils/ids");

function correlationMiddleware(req, res, next) {
  const correlationId = req.headers["x-request-id"] || createId("req");
  req.correlationId = correlationId;
  res.setHeader("x-request-id", correlationId);
  next();
}

module.exports = {
  correlationMiddleware,
};
