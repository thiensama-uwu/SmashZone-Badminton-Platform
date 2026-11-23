/* eslint-disable no-console */
// Backend benchmark harness — measures 8 backend concerns using the REAL
// project modules, with an in-memory Redis emulator so NO docker/infra is needed.
// Output: JSON lines collected into results by the runner.

const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const SHARED = path.join(__dirname, "..", "..", "backend", "shared", "lib");
const { acquireLock, releaseLock } = require(path.join(SHARED, "distributed-lock.js"));
const idem = require(path.join(SHARED, "idempotency-store.js"));
const { createRateLimiter, createRedisRateLimiter } = require(path.join(SHARED, "rate-limiter.js"));
const { FakeRedis } = require("./fake-redis.cjs");

// Real project Zod schema (booking hold input)
const bookingSchemas = require(path.join(
  __dirname, "..", "..", "backend", "booking-service", "src", "models", "booking-schemas.js"
));

const results = {};
const now = () => Number(process.hrtime.bigint()) / 1e6; // ms
const pct = (arr, p) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

// ── #1 Double-booking prevention under concurrency ────────────────────────
async function benchDoubleBooking() {
  const redis = new FakeRedis();
  const N = 1000;
  const key = "lock:slot:court-1:2026-08-20:18:00";
  let success = 0;
  const attempts = Array.from({ length: N }, async () => {
    const token = await acquireLock({ client: redis, key, ttlMs: 5000 });
    if (token) {
      success += 1;
      // hold briefly then release (winner completes its booking)
      await releaseLock({ client: redis, key, token });
      return true;
    }
    return false;
  });
  // Fire the first winner, then hammer with the rest WITHOUT releasing to prove exclusion
  // Simpler + strict: run all concurrently, but winner holds the lock (no release) so
  // only ONE can ever hold it at a time within the same tick.
  success = 0;
  const held = [];
  await Promise.all(
    Array.from({ length: N }, async () => {
      const token = await acquireLock({ client: redis, key, ttlMs: 5000 });
      if (token) { success += 1; held.push(token); }
    })
  );
  await Promise.all(attempts); // exercise release path too

  results.doubleBooking = {
    metric: "Chống double-booking (Redis distributed lock)",
    concurrentRequests: N,
    grantedLock: success,
    rejected: N - success,
    blockRatePct: Number((((N - success) / N) * 100).toFixed(2)),
  };
}

// ── #2 Idempotency dedup ──────────────────────────────────────────────────
async function benchIdempotency() {
  const redis = new FakeRedis();
  const N = 500;
  const key = "idem:pay:order-123";
  let created = 0;
  let replayed = 0;
  await Promise.all(
    Array.from({ length: N }, async () => {
      const claimed = await idem.claimProcessing(redis, key, 60000);
      if (claimed) {
        created += 1;
        await idem.setSuccess(redis, key, { orderId: "order-123" }, 60000);
      } else {
        replayed += 1;
      }
    })
  );
  results.idempotency = {
    metric: "Idempotency chống tạo trùng khi retry",
    duplicateRequests: N,
    recordsCreated: created,
    duplicatesBlocked: replayed,
    dedupRatePct: Number(((replayed / (N - 1)) * 100).toFixed(2)),
  };
}

// ── #3 Bcrypt hashing cost (brute-force resistance) ───────────────────────
async function benchBcrypt() {
  const rounds = 10; // cost used for password hashing
  const iters = 50;
  const pw = "S3cureP@ssw0rd!";
  const t0 = now();
  for (let i = 0; i < iters; i++) await bcrypt.hash(pw, rounds);
  const totalMs = now() - t0;
  const perHash = totalMs / iters;
  results.bcrypt = {
    metric: "Bcrypt password hashing (chống brute-force)",
    costFactor: rounds,
    msPerHash: Number(perHash.toFixed(2)),
    hashesPerSecond: Number((1000 / perHash).toFixed(1)),
    note: "SHA-256 raw ~vài triệu hash/s → bcrypt chậm hơn ~5-6 bậc, làm brute-force offline bất khả thi",
  };
}

// ── #4 Zod validation throughput ──────────────────────────────────────────
async function benchZod() {
  const schema = bookingSchemas.holdSchema || Object.values(bookingSchemas).find((s) => s && s.safeParse);
  const payload = {
    courtId: "court-1",
    date: "2026-08-20",
    segments: [
      { startTime: "18:00", endTime: "19:00" },
      { startTime: "19:00", endTime: "20:00" },
    ],
    startTime: "18:00",
    endTime: "20:00",
    origin: "web",
  };
  const N = 100000;
  const t0 = now();
  for (let i = 0; i < N; i++) schema.safeParse(payload);
  const totalMs = now() - t0;
  results.zod = {
    metric: "Zod input validation overhead",
    iterations: N,
    validationsPerSecond: Number(((N / totalMs) * 1000).toFixed(0)),
    microsecondsPerValidation: Number(((totalMs * 1000) / N).toFixed(2)),
  };
}

// ── #5 Rate limiter accuracy (in-memory fallback, real module) ────────────
async function benchRateLimiterAccuracy() {
  const limit = 5;
  const isAllowed = createRateLimiter({ limit, windowMs: 60000 });
  const N = 10000;
  let allowed = 0;
  for (let i = 0; i < N; i++) if (isAllowed("user:1").allowed) allowed += 1;
  results.rateLimiter = {
    metric: "Fixed-window rate limiter (chống brute-force/spam)",
    limitPerWindow: limit,
    totalRequests: N,
    allowedThrough: allowed,
    blocked: N - allowed,
    accuracyPct: allowed === limit ? 100 : Number(((limit / allowed) * 100).toFixed(2)),
  };
}

// ── #5b Redis rate limiter throughput (real module + emulator) ────────────
async function benchRateLimiterThroughput() {
  const redis = new FakeRedis();
  const isAllowed = createRedisRateLimiter({ redisClient: redis, limit: 1e9, windowMs: 60000 });
  const N = 50000;
  const t0 = now();
  for (let i = 0; i < N; i++) await isAllowed("gw:route:1");
  const totalMs = now() - t0;
  results.rateLimiterThroughput = {
    metric: "Rate limiter throughput (Redis Lua fixed-window)",
    iterations: N,
    opsPerSecond: Number(((N / totalMs) * 1000).toFixed(0)),
    msPerOp: Number((totalMs / N).toFixed(4)),
  };
}

// ── #8 Cache vs source (representative) ───────────────────────────────────
async function benchCache() {
  // Build a representative "availability" payload (a court day: ~32 slots).
  const buildAvailability = () => {
    const slots = [];
    for (let h = 6; h < 22; h++) {
      for (const m of ["00", "30"]) {
        slots.push({
          startTime: `${String(h).padStart(2, "0")}:${m}`,
          endTime: `${String(h).padStart(2, "0")}:${m === "00" ? "30" : "00"}`,
          status: (h + Number(m)) % 3 === 0 ? "BOOKED" : "AVAILABLE",
          price: 80000 + (h >= 17 ? 40000 : 0),
        });
      }
    }
    return { courtId: "court-1", date: "2026-08-20", slots };
  };

  const N = 20000;
  // Cold path: recompute + serialize every request (simulates DB build + JSON)
  let t0 = now();
  for (let i = 0; i < N; i++) JSON.stringify(buildAvailability());
  const coldMs = now() - t0;

  // Warm path: serve pre-serialized cached string (Redis/in-memory cache hit)
  const cached = JSON.stringify(buildAvailability());
  const cache = new Map([["court:availability:court-1:2026-08-20", cached]]);
  t0 = now();
  for (let i = 0; i < N; i++) { const v = cache.get("court:availability:court-1:2026-08-20"); if (!v) throw 0; }
  const warmMs = now() - t0;

  results.cache = {
    metric: "Cache lịch trống (cache hit vs build lại payload)",
    requests: N,
    coldMsPerReq: Number((coldMs / N).toFixed(4)),
    warmMsPerReq: Number((warmMs / N).toFixed(4)),
    latencyReductionPct: Number((((coldMs - warmMs) / coldMs) * 100).toFixed(1)),
    speedupX: Number((coldMs / warmMs).toFixed(1)),
    note: "Phần 'cold' mô phỏng chi phí build+serialize payload phía server (đại diện, không tính round-trip DB thật)",
  };
}

// ── #10 JWT verify throughput (stateless auth) ────────────────────────────
async function benchJwt() {
  const secret = "bench-secret-key-please-ignore";
  const token = jwt.sign(
    { sub: "user-1", email: "a@b.com", roles: ["customer"] },
    secret,
    { expiresIn: "15m" }
  );
  const N = 5000;
  const t0 = now();
  for (let i = 0; i < N; i++) jwt.verify(token, secret);
  const totalMs = now() - t0;
  results.jwt = {
    metric: "JWT verify (xác thực stateless, không chạm DB)",
    iterations: N,
    verificationsPerSecond: Number(((N / totalMs) * 1000).toFixed(0)),
    msPerVerify: Number((totalMs / N).toFixed(4)),
  };
}

// ── #9 Auth+RBAC middleware pipeline throughput (in-process) ──────────────
async function benchGatewayPipeline() {
  const secret = "bench-secret-key-please-ignore";
  const token = jwt.sign({ sub: "u1", email: "a@b.com", roles: ["admin"] }, secret, { expiresIn: "15m" });
  const required = "admin";
  const isAllowed = createRateLimiter({ limit: 1e9, windowMs: 60000 });

  // Emulates the gateway per-request pipeline: rate-limit -> verify JWT -> RBAC check
  const handle = (authHeader) => {
    if (!isAllowed("ip:1.2.3.4").allowed) return 429;
    const t = authHeader.slice(7);
    let decoded;
    try { decoded = jwt.verify(t, secret); } catch { return 401; }
    if (!decoded.roles.includes(required)) return 403;
    return 200;
  };

  const N = 5000;
  const header = `Bearer ${token}`;
  const t0 = now();
  const lat = [];
  for (let i = 0; i < N; i++) {
    const s = now();
    handle(header);
    lat.push(now() - s);
  }
  const totalMs = now() - t0;
  results.gatewayPipeline = {
    metric: "Gateway pipeline (rate-limit + JWT verify + RBAC) — in-process",
    iterations: N,
    requestsPerSecond: Number(((N / totalMs) * 1000).toFixed(0)),
    p50Ms: Number(pct(lat, 50).toFixed(4)),
    p95Ms: Number(pct(lat, 95).toFixed(4)),
    p99Ms: Number(pct(lat, 99).toFixed(4)),
    note: "Đo chi phí CPU của pipeline bảo mật, không gồm network/proxy tới downstream service",
  };
}

async function main() {
  const step = async (name, fn) => { const t = now(); await fn(); console.error(`  ✓ ${name} (${(now() - t).toFixed(0)}ms)`); };
  await step("doubleBooking", benchDoubleBooking);
  await step("idempotency", benchIdempotency);
  await step("bcrypt", benchBcrypt);
  await step("zod", benchZod);
  await step("rateLimiter", benchRateLimiterAccuracy);
  await step("rateLimiterThroughput", benchRateLimiterThroughput);
  await step("cache", benchCache);
  await step("jwt", benchJwt);
  await step("gatewayPipeline", benchGatewayPipeline);
  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
