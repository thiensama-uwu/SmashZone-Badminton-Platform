const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { AppError } = require("../../../shared/lib/errors");
const { createRateLimiter, createRedisRateLimiter } = require("../../../shared/lib/rate-limiter");
const { verifyToken } = require("../../../shared/utils/jwt");
const { getRedisClient } = require("../../../shared/lib/redis");

function createGatewayService(config) {
  const redisClient = getRedisClient({ redisUrl: config.redisUrl, logger: config.logger });
  const uploadsDir = path.join(__dirname, "..", "..", "uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });

  const warned = { value: false };
  const wrapLimiter = (redisLimiter, fallbackLimiter) => {
    return async (key) => {
      if (!redisLimiter) return fallbackLimiter(key);
      try {
        return await redisLimiter(key);
      } catch (error) {
        if (!warned.value) {
          warned.value = true;
          config.logger.warn("Redis rate limiter failed; falling back to in-memory", { reason: error.message });
        }
        return fallbackLimiter(key);
      }
    };
  };

  const fallbackAuthLimiter = createRateLimiter({ limit: 10, windowMs: 60 * 1000, lockMs: 5 * 60 * 1000 });
  const fallbackBookingLimiter = createRateLimiter({ limit: 20, windowMs: 60 * 1000 });
  const fallbackWebhookLimiter = createRateLimiter({ limit: 60, windowMs: 60 * 1000 });

  const redisAuthLimiter = redisClient ? createRedisRateLimiter({ redisClient, limit: 10, windowMs: 60 * 1000, lockMs: 5 * 60 * 1000 }) : null;
  const redisBookingLimiter = redisClient ? createRedisRateLimiter({ redisClient, limit: 20, windowMs: 60 * 1000 }) : null;
  const redisWebhookLimiter = redisClient ? createRedisRateLimiter({ redisClient, limit: 60, windowMs: 60 * 1000 }) : null;

  const authLimiter = wrapLimiter(redisAuthLimiter, fallbackAuthLimiter);
  const bookingLimiter = wrapLimiter(redisBookingLimiter, fallbackBookingLimiter);
  const webhookLimiter = wrapLimiter(redisWebhookLimiter, fallbackWebhookLimiter);

  const publicRoutes = [
    { method: "POST", pattern: /^\/auth\/(register|login|google|refresh|forgot-password|reset-password)$/ },
    { method: "GET", pattern: /^\/courts/ },
    { method: "POST", pattern: /^\/payments\/webhook/ },
    { method: "POST", pattern: /^\/payments\/dev\/complete/ },
    { method: "GET", pattern: /^\/docs\/openapi.json$/ },
    { method: "POST", pattern: /^\/contact$/ },
    { method: "GET", pattern: /^\/uploads\// },
  ];

  const adminRoutes = [
    { method: "POST", pattern: /^\/courts$/ },
    { method: "PATCH", pattern: /^\/courts\// },
    { method: "DELETE", pattern: /^\/courts\// },
    { method: "POST", pattern: /^\/courts\/.+\/(price-schedules|policies)$/ },
    { method: "POST", pattern: /^\/admin\/users$/ },
    { method: "GET", pattern: /^\/admin\/users/ },
    { method: "PATCH", pattern: /^\/admin\/users\// },
    { method: "DELETE", pattern: /^\/admin\/users\// },
    { method: "POST", pattern: /^\/payments\/refunds\/.+\/(manual-complete|fail|retry)$/ },
  ];

  const allowedMimeToExt = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
  };

  const staffRoutes = [
    { method: "POST", pattern: /^\/bookings\/staff-create$/ },
    { method: "POST", pattern: /^\/bookings\/.+\/check-in$/ },
    { method: "POST", pattern: /^\/bookings\/.+\/complete$/ },
    { method: "POST", pattern: /^\/bookings\/.+\/confirm-payment$/ },
    { method: "POST", pattern: /^\/bookings\/.+\/process-refund$/ },
    { method: "POST", pattern: /^\/bookings\/.+\/no-show$/ },
    { method: "POST", pattern: /^\/payments\/.+\/refund$/ },
    { method: "GET", pattern: /^\/payments\/refunds/ },
    { method: "POST", pattern: /^\/payments\/refunds\/.+\/mark-transferred$/ },
  ];

  const validators = [
    { method: "POST", pattern: /^\/auth\/register$/, required: ["email", "password"] },
    { method: "POST", pattern: /^\/auth\/login$/, required: ["password"], anyOf: ["email", "phone"] },
    { method: "POST", pattern: /^\/bookings\/hold$/, required: ["courtId", "date"] },
    { method: "POST", pattern: /^\/bookings$/, required: ["bookingId"] },
    { method: "POST", pattern: /^\/payments$/, required: ["bookingId", "totalAmount"] },
  ];

  function matchRoute(routes, req) {
    return routes.find((route) => route.method === req.method && route.pattern.test(req.path));
  }

  function validate(req) {
    const rule = matchRoute(validators, req);
    if (!rule) {
      return;
    }

    const missing = rule.required.filter((key) => req.body?.[key] === undefined || req.body?.[key] === null || req.body?.[key] === "");
    if (missing.length) {
      throw new AppError(400, "VALIDATION_ERROR", `Missing required fields: ${missing.join(", ")}`);
    }

    if (rule.anyOf) {
      const hasAny = rule.anyOf.some((key) => req.body?.[key] !== undefined && req.body?.[key] !== null && req.body?.[key] !== "");
      if (!hasAny) {
        throw new AppError(400, "VALIDATION_ERROR", `One of the following fields is required: ${rule.anyOf.join(", ")}`);
      }
    }
  }

  async function applyRateLimit(req) {
    let result = { allowed: true };
    if (req.path.startsWith("/auth/")) {
      const key = `rl:gateway:auth:${req.ip}:${req.path}`;
      result = await authLimiter(key);
    } else if (req.path.startsWith("/bookings/")) {
      const key = `rl:gateway:booking:${req.ip}:${req.path}`;
      result = await bookingLimiter(key);
    } else if (req.path.startsWith("/payments/webhook/")) {
      const key = `rl:gateway:webhook:${req.ip}:${req.path}`;
      result = await webhookLimiter(key);
    }

    if (!result.allowed) {
      throw new AppError(429, "RATE_LIMITED", "Too many requests");
    }
  }

  function assertAccess(req) {
    if (matchRoute(publicRoutes, req)) {
      return null;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError(401, "UNAUTHORIZED", "Missing bearer token");
    }

    const auth = verifyToken(authHeader.slice(7), config.jwtSecret);
    if (matchRoute(adminRoutes, req) && !auth.roles.includes("admin")) {
      throw new AppError(403, "FORBIDDEN", "Admin role required");
    }
    if (matchRoute(staffRoutes, req) && !auth.roles.some((role) => ["admin", "staff"].includes(role))) {
      throw new AppError(403, "FORBIDDEN", "Staff or admin role required");
    }
    return auth;
  }

  function resolveTarget(pathname) {
    if (pathname.startsWith("/auth/")) return config.authServiceUrl;
    if (pathname.startsWith("/admin/users")) return config.userServiceUrl;
    if (pathname.startsWith("/users/")) return config.userServiceUrl;
    if (pathname.startsWith("/courts")) return config.courtServiceUrl;
    if (pathname.startsWith("/bookings")) return config.bookingServiceUrl;
    if (pathname.startsWith("/payments")) return config.paymentServiceUrl;
    if (pathname.startsWith("/notifications")) return config.notificationServiceUrl;
    if (pathname.startsWith("/reports")) return config.reportServiceUrl;
    if (pathname.startsWith("/contact")) return config.userServiceUrl;
    return null;
  }

  async function proxy(req, res) {
    validate(req);
    await applyRateLimit(req);
    assertAccess(req);

    const target = resolveTarget(req.path);
    console.log(`[DEBUG] req.path="${req.path}", resolved target="${target}"`);
    if (!target) {
      throw new AppError(404, "ROUTE_NOT_FOUND", "Gateway route not found");
    }

    const url = `${target}${req.originalUrl}`;
    /** Forward inbound Content-Type so webhooks preserve SePay payloads. */
    const forwardHeaders = {
      "content-type": req.headers["content-type"] || "application/json",
      authorization: req.headers.authorization || "",
      "idempotency-key": req.headers["idempotency-key"] || "",
      "x-request-id": req.correlationId,
      "x-mock-signature": req.headers["x-mock-signature"] || "",
    };
    /** SePay (and similar) rely on signatures; omitting breaks verifyWebhook downstream. */
    if (req.path.startsWith("/payments/webhook/")) {
      const sepaySig = req.headers["x-sepay-signature"];
      if (sepaySig) forwardHeaders["x-sepay-signature"] = sepaySig;
    }

    const response = await fetch(url, {
      method: req.method,
      headers: forwardHeaders,
      body: ["GET", "HEAD"].includes(req.method) ? undefined : JSON.stringify(req.body || {}),
    });

    const text = await response.text();
    res.status(response.status);
    if (response.headers.get("content-type")?.includes("application/json")) {
      res.type("application/json");
      res.send(text);
      return;
    }

    res.json({
      code: response.ok ? "OK" : "DOWNSTREAM_ERROR",
      message: text,
      details: null,
      correlation_id: req.correlationId,
    });
  }

  async function uploadImage(req, file) {
    assertAccess(req);
    if (!file) {
      throw new AppError(400, "VALIDATION_ERROR", "Missing image file");
    }

    const extension = allowedMimeToExt[file.mimetype];
    if (!extension) {
      throw new AppError(400, "VALIDATION_ERROR", "Unsupported image type");
    }

    const fileName = `court-${Date.now()}-${crypto.randomUUID()}${extension}`;
    const absolutePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(absolutePath, file.buffer);

    return {
      url: `/api/uploads/${fileName}`,
      fileName,
    };
  }

  function getOpenApi() {
    const filePath = path.join(__dirname, "..", "..", "..", "docs", "openapi.json");
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  }

  return {
    proxy,
    uploadImage,
    getOpenApi,
    getUploadsDir: () => uploadsDir,
  };
}

module.exports = {
  createGatewayService,
};
