const amqp = require("amqplib");

const EXCHANGE_NAME = "project_cnm.events";

async function createBroker({ amqpUrl, serviceName, logger }) {
  let channel = null;
  let connection = null;
  let isConnecting = false;
  let isConnected = false;
  let reconnectTimer = null;
  const consumers = [];

  const connect = async () => {
    if (!amqpUrl) {
      logger.warn("Broker disabled because AMQP_URL is missing");
      return;
    }
    if (isConnecting || isConnected) return;
    isConnecting = true;

    try {
      connection = await amqp.connect(amqpUrl);
      connection.on("error", (err) => {
        logger.error("Broker connection error", { reason: err.message });
        if (err.message !== "Connection closing") {
          isConnected = false;
          scheduleReconnect();
        }
      });
      connection.on("close", () => {
        logger.warn("Broker connection closed");
        isConnected = false;
        scheduleReconnect();
      });

      // Use confirm channel for reliable outbox publishing
      channel = await connection.createConfirmChannel();
      await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: true });
      
      isConnected = true;
      isConnecting = false;
      logger.info("Broker connected", { amqpUrl });

      // Re-attach consumers
      for (const consumer of consumers) {
        await doAttachConsumer(consumer.pattern, consumer.handler);
      }
    } catch (error) {
      isConnecting = false;
      isConnected = false;
      logger.warn("Broker connection failed, retrying in 5s...", { reason: error.message });
      scheduleReconnect();
    }
  };

  const scheduleReconnect = () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      connect().catch(() => {});
    }, 5000);
  };

  const doAttachConsumer = async (pattern, handler) => {
    if (!channel) return;
    try {
      const queueName = `${serviceName}.${pattern.replace(/\./g, "_")}`;
      await channel.assertQueue(queueName, { durable: true });
      await channel.bindQueue(queueName, EXCHANGE_NAME, pattern);
      await channel.consume(queueName, async (message) => {
        if (!message) return;
        try {
          const payload = JSON.parse(message.content.toString());
          await handler(payload);
          channel.ack(message);
        } catch (error) {
          logger.error("Broker consumer failed", { pattern, reason: error.message });
          if (!message.fields.redelivered) {
            channel.nack(message, false, true);
            return;
          }
          channel.nack(message, false, false);
        }
      });
    } catch (err) {
      logger.error("Failed to re-attach consumer", { pattern, reason: err.message });
    }
  };

  async function attachConsumer(pattern, handler) {
    if (!consumers.find(c => c.pattern === pattern)) {
      consumers.push({ pattern, handler });
    }
    if (isConnected) {
      await doAttachConsumer(pattern, handler);
    }
  }

  async function publish(event) {
    if (!isConnected || !channel) {
      throw new Error("Broker not connected");
    }

    return new Promise((resolve, reject) => {
      const eventType = event.event_type || event.eventType;
      channel.publish(
        EXCHANGE_NAME,
        eventType,
        Buffer.from(JSON.stringify(event)),
        { contentType: "application/json", persistent: true },
        (err, ok) => {
          if (err !== null) {
            logger.error("Broker publish nacked", { reason: err.message, eventType });
            return reject(err);
          }
          resolve(ok);
        }
      );
    });
  }

  await connect();

  return {
    publish,
    consume: attachConsumer,
    get isConnected() {
      return isConnected;
    }
  };
}

module.exports = {
  createBroker,
  EXCHANGE_NAME,
};
