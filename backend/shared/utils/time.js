function now() {
  return Date.now();
}

function toIso(value) {
  return new Date(value).toISOString();
}

function isExpired(timestamp) {
  return Number(timestamp) <= now();
}

module.exports = {
  now,
  toIso,
  isExpired,
};
