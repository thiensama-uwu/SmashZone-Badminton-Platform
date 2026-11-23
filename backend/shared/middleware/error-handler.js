function notFoundHandler(req, res) {
  res.status(404).json({
    code: "NOT_FOUND",
    message: "Resource not found",
    details: null,
    correlation_id: req.correlationId || null,
  });
}

function errorHandler(err, req, res, next) {
  void next;
  res.status(err.status || 500).json({
    code: err.code || "INTERNAL_ERROR",
    message: err.message || "Unexpected error",
    details: err.details || null,
    correlation_id: req.correlationId || null,
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
