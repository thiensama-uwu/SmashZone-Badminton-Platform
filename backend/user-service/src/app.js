const { createServiceApp } = require("../../shared/http/create-service-app");
const config = require("./config");
const { UserRepository } = require("./repositories/user-repository");
const { UserService } = require("./services/user-service");
const { createUserRouter } = require("./routes");

const repository = new UserRepository();
const service = new UserService({ repository, config });

const app = createServiceApp({
  serviceName: config.serviceName,
  registerRoutes(expressApp) {
    expressApp.use(createUserRouter(service, config));
  },
});

app.set("defaultPort", config.port);

module.exports = app;
