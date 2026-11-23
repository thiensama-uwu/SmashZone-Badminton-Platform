const { createServiceApp } = require("../../shared/http/create-service-app");
const { createBroker } = require("../../shared/lib/broker");
const config = require("./config");
const { BookingRepository } = require("./repositories/booking-repository");
const { BookingService } = require("./services/booking-service");
const { createBookingRouter } = require("./routes");
const { startHoldSweep } = require("./jobs/hold-cleanup-job");
const { OutboxWorker } = require("../../shared/lib/outbox-worker");

const repository = new BookingRepository();
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

const service = new BookingService({
  repository,
  config,
  outboxWorker,
});

const app = createServiceApp({
  serviceName: config.serviceName,
  registerRoutes(expressApp) {
    expressApp.use(createBookingRouter(service, config));
  },
});

app.set("defaultPort", config.port);
startHoldSweep(service, config);

createBroker({ amqpUrl: config.amqpUrl, serviceName: config.serviceName, logger: config.logger })
  .then(async (broker) => {
    runtime.broker = broker;
    outboxWorker.broker = broker;
    outboxWorker.start();
    await broker.consume("payment.completed", async (event) => {
      await service.markPaymentCompleted({ ...event.payload, correlationId: event.correlation_id });
    });
    await broker.consume("payment.failed", async (event) => {
      await service.markPaymentFailed({ ...event.payload, correlationId: event.correlation_id });
    });
    await broker.consume("payment.refund_completed", async (event) => {
      await service.markRefundCompleted({ ...event.payload, correlationId: event.correlation_id });
    });
    await broker.consume("court.updated", async (event) => {
      await service.invalidateCourtAvailability(event.payload.courtId, event.correlation_id);
    });
    await broker.consume("court.price_updated", async (event) => {
      await service.invalidateCourtAvailability(event.payload.courtId, event.correlation_id);
    });
    await broker.consume("court.deleted", async (event) => {
      await service.invalidateCourtAvailability(event.payload.courtId, event.correlation_id);
    });
  })
  .catch((error) => {
    config.logger.error("Booking broker init failed", { reason: error.message });
  });

module.exports = app;
