const STATE_PROCESSING = "PROCESSING";

function safeJsonParse(text) {
  if (text === null || text === undefined) return null;
  if (typeof text !== "string") return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function safeParseState(raw) {
  if (!raw) return null;
  if (raw === STATE_PROCESSING) return { state: STATE_PROCESSING };

  const parsed = safeJsonParse(raw);
  if (!parsed || parsed.state !== "SUCCESS") return null;
  return { state: "SUCCESS", payload: parsed.payload };
}

async function get(client, key) {
  if (!client) return null;
  const raw = await client.get(key);
  return safeParseState(raw);
}

async function claimProcessing(client, key, ttlMs) {
  if (!client) return false;
  const res = await client.set(key, STATE_PROCESSING, "NX", "PX", ttlMs);
  return Boolean(res);
}

async function setSuccess(client, key, payload, ttlMs) {
  if (!client) return false;
  const value = JSON.stringify({ state: "SUCCESS", payload });
  await client.set(key, value, "PX", ttlMs);
  return true;
}

async function del(client, key) {
  if (!client) return 0;
  return client.del(key);
}

module.exports = {
  STATE_PROCESSING,
  get,
  claimProcessing,
  setSuccess,
  del,
};

