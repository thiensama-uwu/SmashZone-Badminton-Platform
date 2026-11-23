const express = require("express");
const roles = require("../../../shared/constants/roles");
const { requireAuth, requireRoles } = require("../../../shared/middleware/auth");
const { validate } = require("../../../shared/middleware/validate");
const { createPaymentController } = require("../controllers/payment-controller");
const { createPaymentSchema, webhookSchema, refundSchema, manualCompleteRefundSchema, failRefundSchema, retryRefundSchema } = require("../models/payment-schemas");

function createPaymentRouter(service, config) {
  const router = express.Router();
  const controller = createPaymentController(service, config);
  const auth = requireAuth({ jwtSecret: config.jwtSecret });

  router.post("/payments/webhook/mock/sign", validate(webhookSchema), controller.signWebhook);
  router.post("/payments/webhook/mock", validate(webhookSchema), controller.webhook);
  router.post("/payments/webhook/sepay", controller.webhook);
  router.post("/payments/dev/complete", controller.devCompletePayment);
  router.post("/payments", auth, validate(createPaymentSchema), controller.createPayment);
  router.get("/payments/refunds", auth, requireRoles([roles.ADMIN, roles.STAFF]), controller.listRefunds);
  router.post("/payments/refunds/:id/mark-transferred", auth, requireRoles([roles.ADMIN, roles.STAFF]), controller.markRefundTransferred);
  router.post("/payments/refunds/:id/manual-complete", auth, requireRoles([roles.ADMIN]), validate(manualCompleteRefundSchema), controller.manualCompleteRefund);
  router.post("/payments/refunds/:id/fail", auth, requireRoles([roles.ADMIN]), validate(failRefundSchema), controller.failRefund);
  router.post("/payments/refunds/:id/retry", auth, requireRoles([roles.ADMIN]), validate(retryRefundSchema), controller.retryRefund);
  router.get("/payments/:id", auth, controller.getPayment);
  router.post("/payments/:id/refund", auth, validate(refundSchema), controller.refund);
  router.post("/payments/booking/:bookingId/refund", auth, controller.refundByBooking);

  return router;
}

module.exports = {
  createPaymentRouter,
};
