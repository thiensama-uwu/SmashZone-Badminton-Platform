const { createServiceApp } = require("../../shared/http/create-service-app");
const { createBroker } = require("../../shared/lib/broker");
const config = require("./config");
const { PaymentRepository } = require("./repositories/payment-repository");
const { PaymentService } = require("./services/payment-service");
const { createPaymentRouter } = require("./routes");
const { startReconcileJob } = require("./jobs/reconcile-job");
const { OutboxWorker } = require("../../shared/lib/outbox-worker");
const { createProvider } = require("./providers");

const repository = new PaymentRepository();
const runtime = {
  broker: {
    isConnected: false,
    publish: async () => {},
    consume: async () => {},
  },
};
const outboxWorker = new OutboxWorker({
  repository,
  broker: runtime.broker,
  logger: config.logger,
});

const provider = createProvider(config);
config.logger.info(`Payment provider: ${provider.name}`);

const service = new PaymentService({
  repository,
  config,
  outboxWorker,
  provider,
});

const app = createServiceApp({
  serviceName: config.serviceName,
  registerRoutes(expressApp) {
    expressApp.use(createPaymentRouter(service, config));
  },
});

app.set("defaultPort", config.port);
startReconcileJob(service, config);

createBroker({ amqpUrl: config.amqpUrl, serviceName: config.serviceName, logger: config.logger })
  .then(async (broker) => {
    runtime.broker = broker;
    outboxWorker.broker = broker;
    outboxWorker.start();
    await broker.consume("booking.created", async (event) => {
      await service.handleBookingCreated(event.payload, event.correlation_id);
    });
    await broker.consume("booking.reschedule_requested", async (event) => {
      await service.handleBookingCreated(event.payload, event.correlation_id);
    });
    await broker.consume("booking.cancelled", async (event) => {
      await service.handleBookingCancelled(event.payload, event.correlation_id);
    });
  })
  .catch((error) => {
    config.logger.error("Payment broker init failed", { reason: error.message });
  });

module.exports = app;
