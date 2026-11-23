const express = require("express");
const { createReportController } = require("../controllers/report-controller");

function createReportRouter(service) {
  const router = express.Router();
  const controller = createReportController(service);

  router.get("/reports/summary", controller.summary);
  router.get("/reports/revenue", controller.revenue);
  router.get("/reports/export", controller.exportData);
  return router;
}

module.exports = {
  createReportRouter,
};
