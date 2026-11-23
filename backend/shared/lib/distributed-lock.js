const crypto = require("crypto");

const UNLOCK_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

function createToken() {
  return crypto.randomBytes(16).toString("hex");
}

async function acquireLock({ client, key, ttlMs }) {
  if (!client) return null;
  const token = createToken();
  const res = await client.set(key, token, "NX", "PX", ttlMs);
  if (!res) return null;
  return token;
}

async function releaseLock({ client, key, token }) {
  if (!client || !token) return 0;
  // KEYS[1] = key, ARGV[1] = token
  return await client.eval(UNLOCK_SCRIPT, 1, key, token);
}

module.exports = {
  acquireLock,
  releaseLock,
};

