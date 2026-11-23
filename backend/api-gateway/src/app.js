const { createServiceApp } = require("../../shared/http/create-service-app");
const config = require("./config");
const { createGatewayService } = require("./services/gateway-service");
const { createGatewayRouter } = require("./routes");

const service = createGatewayService(config);

const app = createServiceApp({
  serviceName: config.serviceName,
  registerRoutes(expressApp) {
    expressApp.use(createGatewayRouter(service));
  },
});

app.set("defaultPort", config.port);

module.exports = app;
