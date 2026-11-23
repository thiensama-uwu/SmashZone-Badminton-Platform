const { createServiceApp } = require("../../shared/http/create-service-app");
const config = require("./config");
const { AuthRepository } = require("./repositories/auth-repository");
const { AuthService } = require("./services/auth-service");
const { createAuthRouter } = require("./routes");

const repository = new AuthRepository();
const service = new AuthService({ repository, config });

const app = createServiceApp({
  serviceName: config.serviceName,
  registerRoutes(expressApp) {
    expressApp.use(createAuthRouter(service, config));
  },
});

app.set("defaultPort", config.port);

module.exports = app;
