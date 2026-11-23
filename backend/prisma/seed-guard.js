const PROTECTED_COUNTS = [
  { key: "authUsers", label: "auth users", model: "authUser" },
  { key: "profiles", label: "profiles", model: "userProfile" },
  { key: "courts", label: "courts", model: "court" },
  { key: "bookings", label: "bookings", model: "booking" },
  { key: "payments", label: "payments", model: "payment" },
];

function isForceSeedEnabled(env = process.env) {
  return String(env.FORCE_SEED || "").toLowerCase() === "true";
}

async function getProtectedCounts(prisma) {
  const entries = await Promise.all(
    PROTECTED_COUNTS.map(async ({ key, model }) => [key, await prisma[model].count()])
  );
  return Object.fromEntries(entries);
}

function formatNonEmptyCounts(counts) {
  return PROTECTED_COUNTS
    .filter(({ key }) => Number(counts[key] || 0) > 0)
    .map(({ key, label }) => `${label}=${counts[key]}`)
    .join(", ");
}

async function assertSeedAllowed(prisma, env = process.env) {
  if (isForceSeedEnabled(env)) {
    return;
  }

  const counts = await getProtectedCounts(prisma);
  const nonEmptySummary = formatNonEmptyCounts(counts);
  if (nonEmptySummary) {
    throw new Error(
      `Refusing to run seed because database already has data (${nonEmptySummary}). ` +
        "Set FORCE_SEED=true only if you intentionally want to seed this database."
    );
  }
}

module.exports = {
  assertSeedAllowed,
  isForceSeedEnabled,
};
