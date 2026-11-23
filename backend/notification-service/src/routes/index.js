const express = require("express");
const { requireAuth } = require("../../../shared/middleware/auth");
const { validate } = require("../../../shared/middleware/validate");
const { createNotificationController } = require("../controllers/notification-controller");
const { subscriptionSchema, markReadSchema } = require("../models/notification-schemas");

function createNotificationRouter(service, config) {
  const router = express.Router();
  const controller = createNotificationController(service);
  const auth = requireAuth({ jwtSecret: config.jwtSecret });

  router.post("/notifications/subscriptions", auth, validate(subscriptionSchema), controller.subscribe);
  router.get("/notifications", auth, controller.history);
  router.post("/notifications/mark-read", auth, validate(markReadSchema), controller.markRead);

  return router;
}

module.exports = {
  createNotificationRouter,
};
