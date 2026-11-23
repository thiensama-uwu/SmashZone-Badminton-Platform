const { AppError } = require("../../../shared/lib/errors");
const { requestJson } = require("../../../shared/lib/http-client");
const { getRedisClient, redisKey } = require("../../../shared/lib/redis");
const redisCache = require("../../../shared/lib/cache");

class CourtService {
  constructor({ repository, config, outboxWorker }) {
    this.repository = repository;
    this.config = config;
    this.outboxWorker = outboxWorker;
    this.redisClient = getRedisClient({ redisUrl: config.redisUrl, logger: config.logger });
    // Fallback in-memory cache có TTL, dùng khi Redis lỗi/unavailable.
    this.fallbackCache = new Map(); // fullKey -> { value, expiresAt }
  }

  getFallback(key) {
    const entry = this.fallbackCache.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.fallbackCache.delete(key);
      return null;
    }
    return entry.value;
  }

  setFallback(key, value, ttlMs) {
    const expiresAt = typeof ttlMs === "number" && ttlMs > 0 ? Date.now() + ttlMs : null;
    this.fallbackCache.set(key, { value, expiresAt });
  }

  invalidateFallback(prefix) {
    for (const key of this.fallbackCache.keys()) {
      if (key.startsWith(prefix)) this.fallbackCache.delete(key);
    }
  }

  async listCourts(query) {
    const includeDeleted = query.includeDeleted === true || query.includeDeleted === "true";
    const baseKey = `courts:list:${query.page}:${query.limit}:${query.search || ""}:${includeDeleted}`;
    const cacheKey = redisKey(baseKey, { redisPrefix: this.config.redisPrefix });

    if (this.redisClient) {
      const cached = await redisCache.get(this.redisClient, cacheKey);
      if (cached) return cached;
    }

    const fallback = this.getFallback(cacheKey);
    if (fallback) return fallback;

    const { items, total } = await this.repository.listCourts({ ...query, includeDeleted });
    const result = {
      items,
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
      },
    };

    const ttlMs = this.config.cacheTtlCourtsListMs;
    const ok = await redisCache.set(this.redisClient, cacheKey, result, ttlMs);
    if (!ok) this.setFallback(cacheKey, result, ttlMs);
    return result;
  }

  async getFeaturedCourts(limit = 3) {
    const baseKey = `courts:featured:${limit}`;
    const cacheKey = redisKey(baseKey, { redisPrefix: this.config.redisPrefix });

    if (this.redisClient) {
      const cached = await redisCache.get(this.redisClient, cacheKey);
      if (cached) return cached;
    }

    const fallback = this.getFallback(cacheKey);
    if (fallback) return fallback;

    const result = await this.repository.getFeaturedCourts(limit);

    const ttlMs = this.config.cacheTtlCourtsListMs;
    const ok = await redisCache.set(this.redisClient, cacheKey, result, ttlMs);
    if (!ok) this.setFallback(cacheKey, result, ttlMs);
    return result;
  }

  async getCourt(id, includeDeleted = false, bypassCache = false) {
    const baseKey = `court:detail:${id}`;
    const cacheKey = redisKey(baseKey, { redisPrefix: this.config.redisPrefix });

    if (!bypassCache && !includeDeleted && this.redisClient) {
      const cached = await redisCache.get(this.redisClient, cacheKey);
      if (cached) return cached;
    }

    if (!bypassCache && !includeDeleted) {
      const fallback = this.getFallback(cacheKey);
      if (fallback) return fallback;
    }

    const court = await this.repository.getCourt(id, includeDeleted);
    if (!court) throw new AppError(404, "COURT_NOT_FOUND", "Court not found");

    const ttlMs = this.config.cacheTtlCourtDetailMs;
    const ok = await redisCache.set(this.redisClient, cacheKey, court, ttlMs);
    if (!ok) this.setFallback(cacheKey, court, ttlMs);

    return court;
  }

  async getCourtBySlug(slug) {
    const baseKey = `court:detail:slug:${slug}`;
    const cacheKey = redisKey(baseKey, { redisPrefix: this.config.redisPrefix });

    if (this.redisClient) {
      const cached = await redisCache.get(this.redisClient, cacheKey);
      if (cached) return cached;
    }

    const fallback = this.getFallback(cacheKey);
    if (fallback) return fallback;

    const court = await this.repository.getCourtBySlug(slug);
    if (!court) throw new AppError(404, "COURT_NOT_FOUND", "Court not found");

    const ttlMs = this.config.cacheTtlCourtDetailMs;
    const ok = await redisCache.set(this.redisClient, cacheKey, court, ttlMs);
    if (!ok) this.setFallback(cacheKey, court, ttlMs);

    return court;
  }

  async createCourt(input) {
    const created = await this.repository.createCourt(input);
    await this.invalidateCourtsCache();
    return created;
  }

  async invalidateCourtDetail(courtId) {
    const baseKey = `court:detail:${courtId}`;
    const cacheKey = redisKey(baseKey, { redisPrefix: this.config.redisPrefix });
    if (this.redisClient) {
      await redisCache.del(this.redisClient, cacheKey);
    }
    this.fallbackCache.delete(cacheKey);
  }

  async updateCourt(id, input) {
    const isReactivating = input.status === 'ACTIVE';
    await this.getCourt(id, isReactivating);
    const updated = await this.repository.updateCourt(id, input, isReactivating);
    await this.invalidateCourtsCache();
    await this.invalidateCourtDetail(id);
    await this.invalidateAvailability(id);
    // Publish court updated event
    const { createEvent } = require("../../../shared/events/envelope");
    const event = createEvent("court.updated", id, null, {
      courtId: id,
      changes: input,
    });
    await this.recordAndPublish(event);
    return updated;
  }

  async addPriceSchedule(courtId, input) {
    await this.getCourt(courtId);
    await this.invalidateAvailability(courtId);
    await this.invalidateCourtsCache();
    await this.invalidateCourtDetail(courtId);
    const schedule = await this.repository.addPriceSchedule(courtId, input);
    // Publish court price updated event
    const { createEvent } = require("../../../shared/events/envelope");
    const event = createEvent("court.price_updated", courtId, null, {
      courtId,
      price: input.price,
      type: input.type,
      priority: input.priority,
    });
    await this.recordAndPublish(event);
    return schedule;
  }

  async addPolicy(courtId, input) {
    await this.getCourt(courtId);
    return this.repository.addPolicy(courtId, input);
  }

  async getPolicy(courtId) {
    await this.getCourt(courtId);
    return this.repository.getPolicies(courtId);
  }

  async getPriceSchedules(courtId) {
    await this.getCourt(courtId);
    return this.repository.getPriceSchedules(courtId);
  }

  async softDeleteCourt(courtId, actorId) {
    await this.getCourt(courtId);
    const updated = await this.repository.updateCourt(courtId, {
      status: "INACTIVE",
      deletedAt: new Date(),
      deletedBy: actorId,
    });
    await this.invalidateCourtsCache();
    await this.invalidateFeaturedCourtsCache();
    await this.invalidateCourtDetail(courtId);
    // Publish court deleted event
    const { createEvent } = require("../../../shared/events/envelope");
    const event = createEvent("court.deleted", courtId, null, {
      courtId,
      deletedBy: actorId,
    });
    await this.recordAndPublish(event);
    return updated;
  }

  async getAvailability(query, correlationId) {
    const court = await this.getCourt(query.courtId);
    const baseKey = `court:availability:${query.courtId}:${query.date}`;
    const cacheKey = redisKey(baseKey, { redisPrefix: this.config.redisPrefix });

    if (this.redisClient) {
      const cached = await redisCache.get(this.redisClient, cacheKey);
      if (cached) return cached;
    }

    const fallback = this.getFallback(cacheKey);
    if (fallback) return fallback;

    let reservations = [];
    try {
      const result = await requestJson("GET", `${this.config.bookingServiceUrl}/internal/reservations?courtId=${query.courtId}&date=${query.date}`, {
        headers: {
          "x-internal-token": this.config.internalServiceToken,
          "x-request-id": correlationId,
        },
      });
      reservations = result.items || [];
    } catch (error) {
      this.config.logger.warn("Booking reservations unavailable for availability read", { reason: error.message });
    }

    const slots = (await this.repository.getSlots(query.courtId)).map((slot) => {
      // Đặt nhiều giờ liền → booking lưu một reservation (vd. 18:00–20:00), không khớp exact từng ô 1 giờ → phải giao với [start,end).
      const reservation = reservations.find((item) =>
        this._slotIntervalsOverlap(slot.startTime, slot.endTime, item.startTime, item.endTime));
      return {
        id: slot.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: reservation ? reservation.status : "AVAILABLE",
        bookingId: reservation ? reservation.bookingId : null,
      };
    });

    const result = {
      court,
      date: query.date,
      slots,
    };

    const ttlMs = this.config.cacheTtlAvailabilityMs;
    const ok = await redisCache.set(this.redisClient, cacheKey, result, ttlMs);
    if (!ok) this.setFallback(cacheKey, result, ttlMs);
    return result;
  }

  _timeToMinutes(time) {
    const [h = 0, m = 0] = String(time)
      .split(":")
      .map((x) => Number(x));
    return h * 60 + (Number.isFinite(m) ? m : 0);
  }

  /** Hai nửa khoảng [aStart,aEnd) và [bStart,bEnd) có giao nhau (chuẩn khung giờ cùng ngày). */
  _slotIntervalsOverlap(aStart, aEnd, bStart, bEnd) {
    const a0 = this._timeToMinutes(aStart);
    const a1 = this._timeToMinutes(aEnd);
    const b0 = this._timeToMinutes(bStart);
    const b1 = this._timeToMinutes(bEnd);
    return a0 < b1 && b0 < a1;
  }

  /**
   * Số giờ tính tiền trên khoảng [startTime, endTime) — đồng bộ BookingPage (nhiều slot liên tiếp = nhiều × giá giờ).
   */
  _billableHours(startTime, endTime) {
    const spanMinutes = this._timeToMinutes(endTime) - this._timeToMinutes(startTime);
    if (!Number.isFinite(spanMinutes) || spanMinutes <= 0) return 1;
    return Math.max(1, Math.ceil(spanMinutes / 60));
  }

  /**
   * Phụ thu giờ tối (đồng bộ với frontend BookingPage): mỗi khung giờ bắt đầu 19:00 / 20:00 / 21:00 trong khoảng đặt +20.000đ.
   */
  _eveningPeakSurchargeVnd(startTime, endTime) {
    const PEAK_START_HOURS = new Set(["19:00", "20:00", "21:00"]);
    const SURCHARGE = 20000;
    const toHHMM = (mins) => {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    };
    let extra = 0;
    let cur = this._timeToMinutes(startTime);
    const end = this._timeToMinutes(endTime);
    while (cur < end) {
      if (PEAK_START_HOURS.has(toHHMM(cur))) extra += SURCHARGE;
      cur += 60;
    }
    return extra;
  }

  async getPriceQuote(input) {
    await this.getCourt(input.courtId);
    const schedules = await this.repository.getPriceSchedules(input.courtId);
    const selected = schedules.find((schedule) => {
      if (schedule.type === "holiday") {
        return Array.isArray(schedule.dates) && schedule.dates.includes(input.date);
      }
      if (schedule.type === "peak-hour") {
        return input.startTime >= schedule.startTime && input.endTime <= schedule.endTime;
      }
      return schedule.type === "default";
    }) || schedules[schedules.length - 1];

    const policy = await this.repository.getPolicies(input.courtId);
    const billableHours = this._billableHours(input.startTime, input.endTime);
    const eveningPeak = this._eveningPeakSurchargeVnd(input.startTime, input.endTime);
    return {
      courtId: input.courtId,
      price: billableHours * selected.price + eveningPeak,
      pricingSnapshot: selected,
      policySnapshot: policy,
    };
  }

  async invalidateAvailability(courtId) {
    const basePrefix = `court:availability:${courtId}:`;
    const fullPrefix = redisKey(basePrefix, { redisPrefix: this.config.redisPrefix });

    if (this.redisClient) {
      const pattern = redisKey(`${basePrefix}*`, { redisPrefix: this.config.redisPrefix });
      const keys = await redisCache.scan(this.redisClient, pattern, 200);
      await redisCache.del(this.redisClient, ...keys);
    }

    this.invalidateFallback(fullPrefix);
  }

  async invalidateCourtsCache() {
    const fullPrefix = redisKey("courts:list:", { redisPrefix: this.config.redisPrefix });

    if (this.redisClient) {
      const pattern = redisKey("courts:list:*", { redisPrefix: this.config.redisPrefix });
      const keys = await redisCache.scan(this.redisClient, pattern, 200);
      await redisCache.del(this.redisClient, ...keys);
    }

    this.invalidateFallback(fullPrefix);
  }

  async invalidateFeaturedCourtsCache() {
    const fullPrefix = redisKey("courts:featured:", { redisPrefix: this.config.redisPrefix });

    if (this.redisClient) {
      const pattern = redisKey("courts:featured:*", { redisPrefix: this.config.redisPrefix });
      const keys = await redisCache.scan(this.redisClient, pattern, 200);
      await redisCache.del(this.redisClient, ...keys);
    }

    this.invalidateFallback(fullPrefix);
  }

  async recordAndPublish(event) {
    await this.repository.saveOutbox(event);
    if (this.outboxWorker) {
      this.outboxWorker.wakeUp();
    }
  }
}

module.exports = {
  CourtService,
};
