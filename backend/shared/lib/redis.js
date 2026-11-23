const Redis = require("ioredis");

let singleton = null;
let singletonOptions = null;

function getRedisUrl(options = {}) {
  return options.redisUrl || process.env.REDIS_URL;
}

function getRedisDb(options = {}) {
  if (typeof options.redisDb === "number") return options.redisDb;
  const raw = options.redisDb || process.env.REDIS_DB;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function isTlsEnabled(options = {}) {
  if (typeof options.redisTlsEnabled === "boolean") return options.redisTlsEnabled;
  const raw = options.redisTlsEnabled || process.env.REDIS_TLS_ENABLED;
  if (raw === undefined) return false;
  return raw === true || raw === "true" || raw === "1";
}

function getRedisPrefix(options = {}) {
  return options.redisPrefix || process.env.REDIS_PREFIX || "cnm";
}

function redisKey(key, options = {}) {
  const prefix = getRedisPrefix(options);
  return `${prefix}:${key}`;
}

function shouldUseRedis(redisUrl) {
  return Boolean(redisUrl);
}

function createClient({ redisUrl, logger }) {
  // lazyConnect prevents eager connection attempts on startup.
  const db = getRedisDb();
  const tlsEnabled = isTlsEnabled();

  const client = new Redis(redisUrl, {
    lazyConnect: true,
    enableReadyCheck: true,
    maxRetriesPerRequest: null,
    db,
    tls: tlsEnabled ? {} : undefined,
    retryStrategy: (times) => {
      // Exponential backoff with an upper bound.
      const delay = Math.min(times * 100, 2000);
      return delay;
    },
  });

  if (logger) {
    let lastWarnAt = 0;
    client.on("connect", () => {
      logger.info("Redis connected");
    });
    client.on("error", (err) => {
      const now = Date.now();
      // Throttle frequent error logs to avoid log spam.
      if (now - lastWarnAt > 5000) {
        lastWarnAt = now;
        logger.warn("Redis error", { reason: err?.message });
      }
    });
    client.on("close", () => {
      logger.warn("Redis connection closed");
    });
    client.on("reconnecting", () => {
      const now = Date.now();
      if (now - lastWarnAt > 5000) {
        lastWarnAt = now;
        logger.warn("Redis reconnecting");
      }
    });
  }

  return client;
}

/**
 * Returns a singleton ioredis client for the current service process.
 * If REDIS_URL is not set, returns null.
 */
function getRedisClient(options = {}) {
  const redisUrl = getRedisUrl(options);
  if (!shouldUseRedis(redisUrl)) {
    return null;
  }

  const stableOptions = {
    redisUrl,
  };

  if (singleton && singletonOptions && singletonOptions.redisUrl === stableOptions.redisUrl) {
    return singleton;
  }

  singletonOptions = stableOptions;
  singleton = createClient({ redisUrl, logger: options.logger });
  return singleton;
}

module.exports = {
  getRedisClient,
  redisKey,
};

