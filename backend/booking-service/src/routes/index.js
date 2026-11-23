const express = require("express");
const roles = require("../../../shared/constants/roles");
const { requireAuth, requireRoles } = require("../../../shared/middleware/auth");
const { validate } = require("../../../shared/middleware/validate");
const { createBookingController } = require("../controllers/booking-controller");
const { holdSchema, createBookingSchema, cancelBookingSchema, rescheduleSchema, staffCreateSchema, reservationQuerySchema } = require("../models/booking-schemas");

function createBookingRouter(service, config) {
  const router = express.Router();
  const controller = createBookingController(service);
  const auth = requireAuth({ jwtSecret: config.jwtSecret });

  router.get("/internal/reservations", validate(reservationQuerySchema, "query"), controller.reservations);
  router.post("/bookings/staff-create", auth, requireRoles([roles.ADMIN, roles.STAFF]), validate(staffCreateSchema), controller.staffCreate);
  router.post("/bookings/hold", auth, validate(holdSchema), controller.hold);
  router.post("/bookings", auth, validate(createBookingSchema), controller.createBooking);
  router.get("/bookings/history", auth, controller.history);
  router.get("/bookings/:id", auth, controller.getBooking);
  router.post("/bookings/:id/cancel", auth, validate(cancelBookingSchema), controller.cancel);
  router.post("/bookings/:id/reschedule", auth, validate(rescheduleSchema), controller.reschedule);
  router.post("/bookings/:id/check-in", auth, requireRoles([roles.ADMIN, roles.STAFF]), controller.checkIn);
  router.post("/bookings/:id/complete", auth, requireRoles([roles.ADMIN, roles.STAFF]), controller.complete);
  router.post("/bookings/:id/confirm-payment", auth, requireRoles([roles.ADMIN, roles.STAFF]), controller.confirmPayment);
  router.post("/bookings/:id/process-refund", auth, requireRoles([roles.ADMIN, roles.STAFF]), controller.processRefund);
  router.post("/bookings/:id/no-show", auth, requireRoles([roles.ADMIN, roles.STAFF]), controller.markNoShow);

  return router;
}

module.exports = {
  createBookingRouter,
};
