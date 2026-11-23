const { createServiceApp } = require("../../shared/http/create-service-app");
const config = require("./config");
const { ReportService } = require("./services/report-service");
const { createReportRouter } = require("./routes");

const service = new ReportService();

const app = createServiceApp({
  serviceName: config.serviceName,
  registerRoutes(expressApp) {
    expressApp.use(createReportRouter(service));
  },
});

app.set("defaultPort", config.port);

module.exports = app;
