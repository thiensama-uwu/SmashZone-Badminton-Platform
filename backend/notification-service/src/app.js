const { createServiceApp } = require("../../shared/http/create-service-app");
const { createBroker } = require("../../shared/lib/broker");
const config = require("./config");
const { NotificationRepository } = require("./repositories/notification-repository");
const { NotificationService } = require("./services/notification-service");
const { createNotificationRouter } = require("./routes");

const repository = new NotificationRepository();
const service = new NotificationService({ repository, config });

const app = createServiceApp({
  serviceName: config.serviceName,
  registerRoutes(expressApp) {
    expressApp.use(createNotificationRouter(service, config));
  },
});

app.set("defaultPort", config.port);

createBroker({ amqpUrl: config.amqpUrl, serviceName: config.serviceName, logger: config.logger })
  .then(async (broker) => {
    await broker.consume("booking.confirmed", async (event) => service.dispatchFromEvent(event));
    await broker.consume("booking.cancelled", async (event) => service.dispatchFromEvent(event));
    await broker.consume("booking.rescheduled", async (event) => service.dispatchFromEvent(event));
    await broker.consume("booking.refunded", async (event) => service.dispatchFromEvent(event));
    await broker.consume("payment.failed", async (event) => service.dispatchFromEvent(event));
  })
  .catch((error) => {
    config.logger.error("Notification broker init failed", { reason: error.message });
  });

module.exports = app;
