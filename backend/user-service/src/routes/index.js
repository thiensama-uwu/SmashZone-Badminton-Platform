const express = require("express");
const roles = require("../../../shared/constants/roles");
const { requireAuth, requireRoles } = require("../../../shared/middleware/auth");
const { validate } = require("../../../shared/middleware/validate");
const { createUserController } = require("../controllers/user-controller");
const { bootstrapProfileSchema, updateProfileSchema, adminUpdateUserSchema, adminCreateUserSchema, listUsersQuerySchema } = require("../models/user-schemas");

function createUserRouter(service, config) {
  const router = express.Router();
  const controller = createUserController(service, config);
  const auth = requireAuth({ jwtSecret: config.jwtSecret });

  router.post("/internal/profiles/bootstrap", validate(bootstrapProfileSchema), controller.bootstrapProfile);
  router.get("/users/me", auth, controller.me);
  router.patch("/users/me", auth, validate(updateProfileSchema), controller.updateMe);

  router.post("/admin/users", auth, requireRoles([roles.ADMIN]), validate(adminCreateUserSchema), controller.adminCreateUser);
  router.get("/admin/users", auth, requireRoles([roles.ADMIN]), validate(listUsersQuerySchema, "query"), controller.listUsers);
  router.get("/admin/users/:id", auth, requireRoles([roles.ADMIN]), controller.getUser);
  router.patch("/admin/users/:id", auth, requireRoles([roles.ADMIN]), validate(adminUpdateUserSchema), controller.updateUser);
  router.delete("/admin/users/:id", auth, requireRoles([roles.ADMIN]), controller.deleteUser);
  router.post("/contact", controller.submitContact);

  return router;
}

module.exports = {
  createUserRouter,
};
