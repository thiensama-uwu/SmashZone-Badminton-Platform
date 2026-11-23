function safeJsonParse(text) {
  if (text === null || text === undefined) return null;
  if (typeof text !== "string") return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function get(client, key) {
  if (!client) return null;
  try {
    const raw = await client.get(key);
    return safeJsonParse(raw);
  } catch {
    return null;
  }
}

async function set(client, key, value, ttlMs) {
  if (!client) return false;
  try {
    const payload = JSON.stringify(value);
    if (typeof ttlMs === "number" && ttlMs > 0) {
      await client.set(key, payload, "PX", ttlMs);
    } else {
      await client.set(key, payload);
    }
    return true;
  } catch {
    return false;
  }
}

async function del(client, ...keys) {
  if (!client || keys.length === 0) return 0;
  try {
    return await client.del(...keys);
  } catch {
    return 0;
  }
}

async function scan(client, pattern, count = 200) {
  if (!client) return [];
  const keys = [];
  let cursor = "0";

  try {
    do {
      const [nextCursor, batch] = await client.scan(cursor, "MATCH", pattern, "COUNT", count);
      cursor = nextCursor;
      for (const k of batch) keys.push(k);
    } while (cursor !== "0");
  } catch {
    // Ignore scan failures; callers will fallback to DB behavior.
  }

  return keys;
}

module.exports = {
  get,
  set,
  del,
  scan,
};

