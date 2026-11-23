function createRateLimiter({ limit, windowMs, lockMs = 0 }) {
  const bucket = new Map();

  return function isAllowed(key) {
    const now = Date.now();
    const current = bucket.get(key) || { count: 0, resetAt: now + windowMs, lockUntil: 0 };

    if (current.lockUntil && current.lockUntil > now) {
      return { allowed: false, remaining: 0, resetAt: current.lockUntil };
    }

    if (current.resetAt <= now) {
      current.count = 0;
      current.resetAt = now + windowMs;
    }

    current.count += 1;
    if (current.count > limit) {
      current.lockUntil = lockMs ? now + lockMs : current.resetAt;
      bucket.set(key, current);
      return { allowed: false, remaining: 0, resetAt: current.lockUntil };
    }

    bucket.set(key, current);
    return { allowed: true, remaining: Math.max(limit - current.count, 0), resetAt: current.resetAt };
  };
}

const REDIS_FIXED_WINDOW_SCRIPT = `
  local lockTtl = redis.call("PTTL", KEYS[2])
  if lockTtl and lockTtl > 0 then
    return {0, 0, lockTtl}
  end

  local count = redis.call("INCR", KEYS[1])
  if count == 1 then
    redis.call("PEXPIRE", KEYS[1], ARGV[1])
  end

  local limit = tonumber(ARGV[3])
  if count > limit then
    local lockMs = tonumber(ARGV[2])
    local ttl = lockMs
    if ttl == 0 or ttl < 0 then
      ttl = redis.call("PTTL", KEYS[1])
      if not ttl or ttl < 0 then
        ttl = tonumber(ARGV[1])
      end
    end

    redis.call("SET", KEYS[2], "1", "PX", ttl)
    return {0, 0, ttl}
  end

  local remaining = limit - count
  if remaining < 0 then remaining = 0 end

  local ttl = redis.call("PTTL", KEYS[1])
  if not ttl or ttl < 0 then
    ttl = tonumber(ARGV[1])
  end

  return {1, remaining, ttl}
`;

function createRedisRateLimiter({ redisClient, limit, windowMs, lockMs = 0 }) {
  if (!redisClient) {
    throw new Error("Redis client is required for createRedisRateLimiter");
  }

  return async function isAllowed(key) {
    const counterKey = `${key}:count`;
    const lockKey = `${key}:lock`;

    const res = await redisClient.eval(
      REDIS_FIXED_WINDOW_SCRIPT,
      2,
      counterKey,
      lockKey,
      windowMs,
      lockMs,
      limit
    );

    const allowed = Number(res[0]) === 1;
    const remaining = Number(res[1]);
    const ttlMs = Number(res[2]);

    return {
      allowed,
      remaining: allowed ? remaining : 0,
      resetAt: Date.now() + (ttlMs > 0 ? ttlMs : windowMs),
    };
  };
}

module.exports = {
  createRateLimiter,
  createRedisRateLimiter,
};
