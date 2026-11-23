const { createServiceApp } = require("../../shared/http/create-service-app");
const { createBroker } = require("../../shared/lib/broker");
const { OutboxWorker } = require("../../shared/lib/outbox-worker");
const config = require("./config");
const { CourtRepository } = require("./repositories/court-repository");
const { CourtService } = require("./services/court-service");
const { createCourtRouter } = require("./routes");

const repository = new CourtRepository();

// Initialize broker and outbox worker
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

const service = new CourtService({ repository, config, outboxWorker });

createBroker({ amqpUrl: config.amqpUrl, serviceName: config.serviceName, logger: config.logger })
  .then(async (broker) => {
    runtime.broker = broker;
    outboxWorker.broker = broker;
    outboxWorker.start();
  })
  .catch((error) => {
    config.logger.error("Court broker init failed", { reason: error.message });
  });

const app = createServiceApp({
  serviceName: config.serviceName,
  registerRoutes(expressApp) {
    expressApp.use(createCourtRouter(service, config));
  },
});

app.set("defaultPort", config.port);

module.exports = app;
