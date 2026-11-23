class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status || 500;
    this.code = code || "INTERNAL_ERROR";
    this.details = details || null;
  }
}

module.exports = {
  AppError,
};
