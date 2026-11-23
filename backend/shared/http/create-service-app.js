const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { correlationMiddleware } = require("../middleware/correlation");
const { errorHandler, notFoundHandler } = require("../middleware/error-handler");
const { metricsMiddleware, metricsHandler } = require("../lib/metrics");

function createServiceApp({ serviceName, registerRoutes }) {
  const app = express();

  app.use(
    cors({
      origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : true,
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(correlationMiddleware);
  app.use(metricsMiddleware(serviceName));
  app.use(
    morgan("combined", {
      stream: {
        write(message) {
          console.log(
            JSON.stringify({
              ts: new Date().toISOString(),
              level: "info",
              service: serviceName,
              http_log: message.trim(),
            })
          );
        },
      },
    })
  );

  app.get("/health", (req, res) => {
    res.json({
      service: serviceName,
      status: "ok",
      correlation_id: req.correlationId,
      now: new Date().toISOString(),
    });
  });

  app.get("/metrics", metricsHandler);
  registerRoutes(app);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = {
  createServiceApp,
};
