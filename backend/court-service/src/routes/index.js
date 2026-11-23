const express = require("express");
const roles = require("../../../shared/constants/roles");
const { requireAuth, requireRoles } = require("../../../shared/middleware/auth");
const { validate } = require("../../../shared/middleware/validate");
const { createCourtController } = require("../controllers/court-controller");
const {
  listCourtsQuerySchema,
  createCourtSchema,
  updateCourtSchema,
  availabilityQuerySchema,
  priceScheduleSchema,
  policySchema,
  quoteSchema,
} = require("../models/court-schemas");

function createCourtRouter(service, config) {
  const router = express.Router();
  const controller = createCourtController(service, config);
  const auth = requireAuth({ jwtSecret: config.jwtSecret });

  router.get("/courts", validate(listCourtsQuerySchema, "query"), controller.listCourts);
  router.get("/courts/featured", controller.featuredCourts);
  router.get("/courts/availability", validate(availabilityQuerySchema, "query"), controller.availability);
  router.get("/courts/slug/:slug", controller.getCourtBySlug);
  router.get("/courts/:id", controller.getCourt);
  router.post("/internal/pricing/quote", validate(quoteSchema), controller.quote);
  router.post("/internal/cache/invalidate", controller.invalidateAvailability);
  router.post("/courts", auth, requireRoles([roles.ADMIN]), validate(createCourtSchema), controller.createCourt);
  router.patch("/courts/:id", auth, requireRoles([roles.ADMIN]), validate(updateCourtSchema), controller.updateCourt);
  router.delete("/courts/:id", auth, requireRoles([roles.ADMIN]), controller.deleteCourt);
  router.get("/courts/:id/policy", auth, controller.getPolicy);
  router.get("/courts/:id/price-schedules", auth, controller.getPriceSchedules);
  router.post("/courts/:id/price-schedules", auth, requireRoles([roles.ADMIN]), validate(priceScheduleSchema), controller.addPriceSchedule);
  router.post("/courts/:id/policies", auth, requireRoles([roles.ADMIN]), validate(policySchema), controller.addPolicy);

  return router;
}

module.exports = {
  createCourtRouter,
};
