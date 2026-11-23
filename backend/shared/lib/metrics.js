const client = require("prom-client");

const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

const requestCounter = new client.Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["service", "method", "route", "status_code"],
  registers: [registry],
});

const requestLatency = new client.Histogram({
  name: "http_request_duration_ms",
  help: "HTTP request duration",
  labelNames: ["service", "method", "route"],
  buckets: [25, 50, 100, 200, 400, 800, 1600, 3200],
  registers: [registry],
});

function metricsMiddleware(serviceName) {
  return function attachMetrics(req, res, next) {
    const stop = requestLatency.startTimer({
      service: serviceName,
      method: req.method,
      route: req.path,
    });

    res.on("finish", () => {
      requestCounter.inc({
        service: serviceName,
        method: req.method,
        route: req.path,
        status_code: String(res.statusCode),
      });
      stop();
    });

    next();
  };
}

async function metricsHandler(req, res) {
  void req;
  res.set("content-type", registry.contentType);
  res.send(await registry.metrics());
}

module.exports = {
  metricsMiddleware,
  metricsHandler,
};
