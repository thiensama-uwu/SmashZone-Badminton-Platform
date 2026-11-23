const assert = require("node:assert/strict");
const test = require("node:test");

const { assertSeedAllowed, isForceSeedEnabled } = require("./seed-guard");

function fakePrisma(counts) {
  return {
    authUser: { count: async () => counts.authUsers || 0 },
    userProfile: { count: async () => counts.profiles || 0 },
    court: { count: async () => counts.courts || 0 },
    booking: { count: async () => counts.bookings || 0 },
    payment: { count: async () => counts.payments || 0 },
  };
}

test("seed guard allows empty databases", async () => {
  await assert.doesNotReject(() => assertSeedAllowed(fakePrisma({}), {}));
});

test("seed guard blocks non-empty databases by default", async () => {
  await assert.rejects(
    () => assertSeedAllowed(fakePrisma({ bookings: 1, courts: 5 }), {}),
    /Refusing to run seed because database already has data/
  );
});

test("seed guard allows non-empty databases when FORCE_SEED=true", async () => {
  await assert.doesNotReject(() => assertSeedAllowed(fakePrisma({ bookings: 1 }), { FORCE_SEED: "true" }));
});

test("FORCE_SEED must be explicitly true", () => {
  assert.equal(isForceSeedEnabled({ FORCE_SEED: "1" }), false);
  assert.equal(isForceSeedEnabled({ FORCE_SEED: "true" }), true);
  assert.equal(isForceSeedEnabled({ FORCE_SEED: "TRUE" }), true);
});
