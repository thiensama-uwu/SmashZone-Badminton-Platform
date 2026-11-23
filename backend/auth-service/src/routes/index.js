const express = require("express");
const { requireAuth } = require("../../../shared/middleware/auth");
const { validate } = require("../../../shared/middleware/validate");
const { createAuthController } = require("../controllers/auth-controller");
const { registerSchema, loginSchema, refreshSchema, forgotPasswordSchema, resetPasswordSchema, changePasswordSchema, googleAuthSchema } = require("../models/auth-schemas");

function createAuthRouter(service, config) {
  const router = express.Router();
  const controller = createAuthController(service);
  const auth = requireAuth({ jwtSecret: config.jwtSecret });

  router.post("/auth/register", validate(registerSchema), controller.register);
  router.post("/auth/login", validate(loginSchema), controller.login);
  router.post("/auth/google", validate(googleAuthSchema), controller.googleAuth);
  router.post("/auth/refresh", validate(refreshSchema), controller.refresh);
  router.post("/auth/logout", validate(refreshSchema), controller.logout);
  router.post("/auth/forgot-password", validate(forgotPasswordSchema), controller.forgotPassword);
  router.post("/auth/reset-password", validate(resetPasswordSchema), controller.resetPassword);
  router.post("/auth/change-password", auth, validate(changePasswordSchema), controller.changePassword);

  return router;
}

module.exports = {
  createAuthRouter,
};
