const { AppError } = require("../lib/errors");
const { verifyToken } = require("../utils/jwt");

function requireAuth({ jwtSecret }) {
  return function authMiddleware(req, res, next) {
    void res;
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(new AppError(401, "UNAUTHORIZED", "Missing bearer token"));
    }

    try {
      const token = authHeader.slice(7);
      req.auth = verifyToken(token, jwtSecret);
      return next();
    } catch (error) {
      return next(new AppError(401, "INVALID_TOKEN", "Invalid or expired token"));
    }
  };
}

function requireRoles(roles) {
  return function rolesMiddleware(req, res, next) {
    void res;
    if (!req.auth || !roles.some((role) => req.auth.roles.includes(role))) {
      return next(new AppError(403, "FORBIDDEN", "Insufficient permission"));
    }

    return next();
  };
}

module.exports = {
  requireAuth,
  requireRoles,
};
