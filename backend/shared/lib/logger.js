function log(level, service, message, meta) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    service,
    message,
    ...meta,
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }

  console.log(line);
}

function createLogger(service) {
  return {
    info(message, meta = {}) {
      log("info", service, message, meta);
    },
    warn(message, meta = {}) {
      log("warn", service, message, meta);
    },
    error(message, meta = {}) {
      log("error", service, message, meta);
    },
  };
}

module.exports = {
  createLogger,
};
