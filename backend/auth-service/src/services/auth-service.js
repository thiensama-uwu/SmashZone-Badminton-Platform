const roles = require("../../../shared/constants/roles");
const { AppError } = require("../../../shared/lib/errors");
const { requestJson } = require("../../../shared/lib/http-client");
const { createRateLimiter, createRedisRateLimiter } = require("../../../shared/lib/rate-limiter");
const { hashPassword, verifyPassword } = require("../../../shared/utils/password");
const { signAccessToken, signRefreshToken, verifyToken } = require("../../../shared/utils/jwt");
const { getRedisClient } = require("../../../shared/lib/redis");
const { sendMail, buildOtpEmail } = require("../../../shared/lib/mailer");

function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    status: user.status,
    roles: user.roles,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

class AuthService {
  constructor({ repository, config }) {
    this.repository = repository;
    this.config = config;
    const redisClient = getRedisClient({ redisUrl: config.redisUrl, logger: config.logger });

    const warned = { value: false };

    const wrapLimiter = (redisLimiter, fallbackLimiter) => {
      return async (key) => {
        if (!redisLimiter) return fallbackLimiter(key);
        try {
          return await redisLimiter(key);
        } catch (error) {
          if (!warned.value) {
            warned.value = true;
            this.config.logger.warn("Redis rate limiter failed; falling back to in-memory", { reason: error.message });
          }
          return fallbackLimiter(key);
        }
      };
    };

    const fallbackLoginLimiter = createRateLimiter({ limit: 5, windowMs: 60 * 1000, lockMs: 10 * 60 * 1000 });
    const fallbackRegisterLimiter = createRateLimiter({ limit: 10, windowMs: 60 * 1000 });
    const fallbackForgotLimiter = createRateLimiter({ limit: 5, windowMs: 60 * 1000, lockMs: 5 * 60 * 1000 });

    const redisLoginLimiter = redisClient
      ? createRedisRateLimiter({
          redisClient,
          limit: 5,
          windowMs: 60 * 1000,
          lockMs: 10 * 60 * 1000,
        })
      : null;

    const redisRegisterLimiter = redisClient ? createRedisRateLimiter({ redisClient, limit: 10, windowMs: 60 * 1000 }) : null;
    const redisForgotLimiter = redisClient
      ? createRedisRateLimiter({
          redisClient,
          limit: 5,
          windowMs: 60 * 1000,
          lockMs: 5 * 60 * 1000,
        })
      : null;

    this.loginLimiter = wrapLimiter(redisLoginLimiter, fallbackLoginLimiter);
    this.registerLimiter = wrapLimiter(redisRegisterLimiter, fallbackRegisterLimiter);
    this.forgotLimiter = wrapLimiter(redisForgotLimiter, fallbackForgotLimiter);
  }

  buildTokens(user) {
    const payload = { sub: user.id, email: user.email, roles: user.roles };
    return {
      accessToken: signAccessToken(payload, this.config.jwtSecret),
      refreshToken: signRefreshToken(payload, this.config.refreshSecret),
    };
  }

  async register(input, meta) {
    const ip = meta.ip || "register:unknown";
    const limit = await this.registerLimiter(`rl:auth:register:${ip}`);
    if (!limit.allowed) {
      throw new AppError(429, "RATE_LIMITED", "Too many registration attempts");
    }

    // Check existing by email or phone
    if (input.email) {
      const existingByEmail = await this.repository.findByEmail(input.email);
      if (existingByEmail) {
        throw new AppError(409, "EMAIL_TAKEN", "Email already exists");
      }
    }

    if (input.phone) {
      const existingByPhone = await this.repository.findByPhone(input.phone);
      if (existingByPhone) {
        throw new AppError(409, "PHONE_TAKEN", "Phone already exists");
      }
    }

    const passwordHash = await hashPassword(input.password);
    const user = await this.repository.createUser({
      email: input.email,
      phone: input.phone,
      passwordHash,
      roles: [roles.CUSTOMER],
    });

    try {
      await requestJson("POST", `${this.config.userServiceUrl}/internal/profiles/bootstrap`, {
        headers: {
          "x-internal-token": this.config.internalServiceToken,
          "x-request-id": meta.correlationId,
        },
        body: {
          userId: user.id,
          email: input.email,
          phone: input.phone,
          fullName: input.fullName || "New customer",
        },
      });
    } catch (error) {
      this.config.logger.warn("User profile bootstrap skipped", { reason: error.message, userId: user.id });
    }

    const tokens = this.buildTokens(user);
    await this.repository.saveRefreshSession({
      token: tokens.refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    return { user: toPublicUser(user), ...tokens };
  }

  async login(input, meta) {
    const ip = meta.ip || "login:unknown";
    const identifier = input.email || input.phone;
    const limit = await this.loginLimiter(`rl:auth:login:${ip}:${identifier}`);
    if (!limit.allowed) {
      throw new AppError(429, "RATE_LIMITED", "Account temporarily locked because of repeated failures");
    }

    const user = input.phone
      ? await this.repository.findByPhone(input.phone)
      : await this.repository.findByEmail(input.email);

    if (!user) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid credentials");
    }

    if (!user.passwordHash) {
      throw new AppError(409, "PASSWORD_NOT_SET", "This account does not have a password yet");
    }

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid credentials");
    }

    const tokens = this.buildTokens(user);
    await this.repository.saveRefreshSession({
      token: tokens.refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    return { user: toPublicUser(user), ...tokens };
  }

  async loginWithGoogle(input, meta) {
    if (!this.config.googleClientId) {
      throw new AppError(500, "GOOGLE_AUTH_NOT_CONFIGURED", "Google auth is not configured");
    }

    let tokenInfo;
    try {
      tokenInfo = await requestJson("GET", `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(input.idToken)}`);
    } catch {
      throw new AppError(401, "INVALID_GOOGLE_TOKEN", "Google token is invalid or expired");
    }

    if (tokenInfo.aud !== this.config.googleClientId) {
      throw new AppError(401, "INVALID_GOOGLE_TOKEN", "Google token audience mismatch");
    }

    if (String(tokenInfo.email_verified) !== "true") {
      throw new AppError(401, "INVALID_GOOGLE_TOKEN", "Google email is not verified");
    }

    const email = String(tokenInfo.email || "").toLowerCase();
    if (!email) {
      throw new AppError(400, "INVALID_GOOGLE_TOKEN", "Google account email is missing");
    }

    let user = await this.repository.findByEmail(email);
    if (!user) {
      user = await this.repository.createUser({
        email,
        passwordHash: null,
        roles: [roles.CUSTOMER],
      });

      try {
        await requestJson("POST", `${this.config.userServiceUrl}/internal/profiles/bootstrap`, {
          headers: {
            "x-internal-token": this.config.internalServiceToken,
            "x-request-id": meta.correlationId,
          },
          body: {
            userId: user.id,
            email: user.email,
            fullName: tokenInfo.name || tokenInfo.given_name || "Google User",
          },
        });
      } catch (error) {
        this.config.logger.warn("User profile bootstrap skipped (google)", { reason: error.message, userId: user.id });
      }
    }

    const tokens = this.buildTokens(user);
    await this.repository.saveRefreshSession({
      token: tokens.refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return { user: toPublicUser(user), ...tokens };
  }

  async refresh(input) {
    const session = await this.repository.findRefreshSession(input.refreshToken);
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token not found or expired");
    }

    const payload = verifyToken(input.refreshToken, this.config.refreshSecret);
    const user = await this.repository.findById(payload.sub);
    if (!user) {
      throw new AppError(401, "INVALID_REFRESH_TOKEN", "User not found");
    }

    const tokens = this.buildTokens(user);
    await this.repository.revokeRefreshSession(input.refreshToken);
    await this.repository.saveRefreshSession({
      token: tokens.refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    return { user: toPublicUser(user), ...tokens };
  }

  async logout(input) {
    await this.repository.revokeRefreshSession(input.refreshToken);
    return { success: true };
  }

  async forgotPassword(input, meta) {
    const ip = meta.ip || "forgot:unknown";
    const limit = await this.forgotLimiter(`rl:auth:forgot:${ip}:${input.email}`);
    if (!limit.allowed) {
      throw new AppError(429, "RATE_LIMITED", "Too many forgot password attempts");
    }

    const user = await this.repository.findByEmail(input.email);
    if (!user) {
      return { success: true };
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await this.repository.saveOtp(user.id, otp, new Date(Date.now() + 5 * 60 * 1000));

    // Send OTP via email
    const emailPayload = buildOtpEmail(otp, input.email);
    const result = await sendMail(emailPayload, this.config);
    if (!result.sent) {
      this.config.logger.warn("Failed to send OTP email", { email: input.email, reason: result.reason });
    } else {
      this.config.logger.info("OTP email sent", { email: input.email, messageId: result.messageId });
    }

    return { success: true };
  }

  async changePassword(userId, input) {
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }
    if (user.passwordHash) {
      if (!input.currentPassword) {
        throw new AppError(400, "CURRENT_PASSWORD_REQUIRED", "Current password is required");
      }
      const valid = await verifyPassword(input.currentPassword, user.passwordHash);
      if (!valid) {
        throw new AppError(401, "INVALID_CREDENTIALS", "Current password is incorrect");
      }
    }
    const passwordHash = await hashPassword(input.newPassword);
    await this.repository.updatePassword(userId, passwordHash);
    return { success: true };
  }

  async resetPassword(input) {
    const user = await this.repository.findByEmail(input.email);
    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }

    const otpRecord = await this.repository.getOtp(user.id, input.otp);
    if (!otpRecord || otpRecord.expiresAt < new Date()) {
      throw new AppError(400, "INVALID_OTP", "OTP invalid or expired");
    }

    const passwordHash = await hashPassword(input.newPassword);
    await this.repository.updatePassword(user.id, passwordHash);
    await this.repository.clearOtp(otpRecord.id);
    return { success: true };
  }
}

module.exports = {
  AuthService,
};
