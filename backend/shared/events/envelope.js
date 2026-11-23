const { createId } = require("../utils/ids");

function createEvent(eventType, aggregateId, correlationId, payload, schemaVersion = "v1") {
  return {
    event_id: createId("evt"),
    event_type: eventType,
    schema_version: schemaVersion,
    occurred_at: new Date().toISOString(),
    aggregate_id: aggregateId,
    correlation_id: correlationId,
    payload,
  };
}

module.exports = {
  createEvent,
};
