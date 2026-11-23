// Minimal in-memory Redis emulator — implements ONLY the commands used by
// distributed-lock, idempotency-store and rate-limiter, with faithful
// NX/PX/PTTL semantics and JS equivalents of the two Lua scripts.
// Lets us benchmark the real project modules with zero infrastructure (no docker).

class FakeRedis {
  constructor() {
    this.store = new Map(); // key -> { value, expireAt|null }
  }

  _live(key) {
    const e = this.store.get(key);
    if (!e) return null;
    if (e.expireAt !== null && e.expireAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return e;
  }

  async get(key) {
    const e = this._live(key);
    return e ? e.value : null;
  }

  // Supports: set(key, val, "NX", "PX", ttl)  and  set(key, val, "PX", ttl)
  async set(key, value, ...opts) {
    let nx = false;
    let px = null;
    for (let i = 0; i < opts.length; i++) {
      const o = String(opts[i]).toUpperCase();
      if (o === "NX") nx = true;
      else if (o === "PX") px = Number(opts[++i]);
    }
    if (nx && this._live(key)) return null;
    this.store.set(key, { value: String(value), expireAt: px ? Date.now() + px : null });
    return "OK";
  }

  async del(key) {
    return this.store.delete(key) ? 1 : 0;
  }

  async incr(key) {
    const e = this._live(key);
    const n = (e ? Number(e.value) : 0) + 1;
    this.store.set(key, { value: String(n), expireAt: e ? e.expireAt : null });
    return n;
  }

  async pttl(key) {
    const e = this._live(key);
    if (!e) return -2;
    if (e.expireAt === null) return -1;
    return e.expireAt - Date.now();
  }

  async pexpire(key, ms) {
    const e = this._live(key);
    if (!e) return 0;
    e.expireAt = Date.now() + Number(ms);
    return 1;
  }

  // JS equivalent of the two known Lua scripts, dispatched by content.
  async eval(script, numKeys, ...args) {
    const keys = args.slice(0, numKeys);
    const argv = args.slice(numKeys);

    // UNLOCK_SCRIPT: del key iff value == token
    if (script.includes('redis.call("get", KEYS[1]) == ARGV[1]')) {
      const cur = await this.get(keys[0]);
      if (cur === String(argv[0])) return this.del(keys[0]);
      return 0;
    }

    // REDIS_FIXED_WINDOW_SCRIPT: fixed-window counter with lock
    if (script.includes('local count = redis.call("INCR", KEYS[1])')) {
      const [counterKey, lockKey] = keys;
      const windowMs = Number(argv[0]);
      const lockMs = Number(argv[1]);
      const limit = Number(argv[2]);

      const lockTtl = await this.pttl(lockKey);
      if (lockTtl && lockTtl > 0) return [0, 0, lockTtl];

      const count = await this.incr(counterKey);
      if (count === 1) await this.pexpire(counterKey, windowMs);

      if (count > limit) {
        let ttl = lockMs;
        if (ttl === 0 || ttl < 0) {
          ttl = await this.pttl(counterKey);
          if (!ttl || ttl < 0) ttl = windowMs;
        }
        await this.set(lockKey, "1", "PX", ttl);
        return [0, 0, ttl];
      }

      let remaining = limit - count;
      if (remaining < 0) remaining = 0;
      let ttl = await this.pttl(counterKey);
      if (!ttl || ttl < 0) ttl = windowMs;
      return [1, remaining, ttl];
    }

    throw new Error("FakeRedis.eval: unknown script");
  }
}

module.exports = { FakeRedis };
