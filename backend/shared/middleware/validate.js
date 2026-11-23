const { AppError } = require("../lib/errors");

function validate(schema, target = "body") {
  return function validationMiddleware(req, res, next) {
    void res;
    const source = target === "query" ? req.query : req.body;
    const parsed = schema.safeParse(source);
    if (!parsed.success) {
      return next(new AppError(400, "VALIDATION_ERROR", "Request validation failed", parsed.error.flatten()));
    }

    if (target === "query") {
      req.query = parsed.data;
    } else {
      req.body = parsed.data;
    }

    return next();
  };
}

module.exports = {
  validate,
};
