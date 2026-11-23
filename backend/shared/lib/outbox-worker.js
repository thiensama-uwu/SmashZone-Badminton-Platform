class OutboxWorker {
  constructor({ repository, broker, logger, pollIntervalMs = 5000, batchSize = 50 }) {
    this.repository = repository;
    this.broker = broker;
    this.logger = logger;
    this.pollIntervalMs = pollIntervalMs;
    this.batchSize = batchSize;
    this.timer = null;
    this.isRunning = false;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.processOutbox(), this.pollIntervalMs);
    // run immediately
    this.processOutbox();
    this.logger.info("Outbox worker started");
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.logger.info("Outbox worker stopped");
  }

  wakeUp() {
    this.processOutbox();
  }

  async processOutbox() {
    if (this.isRunning) return;
    if (!this.broker.isConnected) return;

    this.isRunning = true;
    try {
      const events = await this.repository.getUnpublishedOutboxEvents({ limit: this.batchSize });
      if (!events || events.length === 0) {
        this.isRunning = false;
        return;
      }

      for (const event of events) {
        if (!this.broker.isConnected) break;

        try {
          // Re-map from Prisma schema format to Event format if needed
          const eventPayload = {
            event_id: event.eventId,
            event_type: event.eventType,
            aggregate_id: event.aggregateId,
            schema_version: event.schemaVersion,
            correlation_id: event.correlationId,
            payload: event.payload
          };

          await this.broker.publish(eventPayload);
          await this.repository.markOutboxPublished(event.eventId);
        } catch (error) {
          this.logger.warn("Outbox publish failed, will retry", { eventId: event.eventId, reason: error.message });
          break;
        }
      }
    } catch (error) {
      this.logger.error("Outbox processing error", { reason: error.message });
    } finally {
      this.isRunning = false;
    }
  }
}

module.exports = { OutboxWorker };
