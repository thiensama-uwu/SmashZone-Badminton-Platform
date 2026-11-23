const { AppError } = require("../../../shared/lib/errors");
const { requestJson } = require("../../../shared/lib/http-client");
const { createEvent } = require("../../../shared/events/envelope");
const { BOOKING_STATES } = require("../../../shared/constants/booking");
const { resolveBookingTransition, TIMEOUT_POLICY } = require("../../../shared/constants/payment-status-map");
const { getRedisClient, redisKey } = require("../../../shared/lib/redis");
const { acquireLock, releaseLock } = require("../../../shared/lib/distributed-lock");
const idempotencyStore = require("../../../shared/lib/idempotency-store");

function timeToMinutesHm(t) {
  const [h = 0, m = 0] = String(t)
    .split(":")
    .map((x) => Number(x));
  return h * 60 + (Number.isFinite(m) ? m : 0);
}

/** Chuẩn hóa các khung giờ từ segments[] hoặc startTime/endTime (legacy). */
function normalizeHoldSegments(input) {
  let raw;
  if (Array.isArray(input.segments) && input.segments.length > 0) {
    raw = input.segments.map((s) => ({ startTime: s.startTime, endTime: s.endTime }));
  } else if (input.startTime && input.endTime) {
    raw = [{ startTime: input.startTime, endTime: input.endTime }];
  } else {
    throw new AppError(400, "VALIDATION_ERROR", "Cần có segments hoặc startTime + endTime.");
  }

  raw.sort((a, b) => a.startTime.localeCompare(b.startTime));

  for (const s of raw) {
    if (timeToMinutesHm(s.endTime) <= timeToMinutesHm(s.startTime)) {
      throw new AppError(400, "VALIDATION_ERROR", "Mỗi khung giờ phải có end sau start.");
    }
  }

  for (let i = 1; i < raw.length; i++) {
    if (timeToMinutesHm(raw[i].startTime) < timeToMinutesHm(raw[i - 1].endTime)) {
      throw new AppError(400, "VALIDATION_ERROR", "Các khung giờ không được chồng lên nhau.");
    }
  }

  return raw;
}

function assertSegmentsNotInPast(input, segments) {
  const now = Date.now();
  for (const segment of segments) {
    const start = new Date(`${input.date}T${segment.startTime}:00`).getTime();
    if (Number.isFinite(start) && start < now) {
      throw new AppError(400, "VALIDATION_ERROR", "Khung giờ đã qua, vui lòng chọn khung giờ khác.");
    }
  }
}

function getRefundRecipient(input = {}) {
  return {
    refundBankName: input.refundBankName || null,
    refundAccountNumber: input.refundAccountNumber || null,
    refundAccountName: input.refundAccountName || null,
  };
}

function assertRefundRecipient(refundAmount, input = {}) {
  if (!refundAmount || refundAmount <= 0) {
    return null;
  }

  const recipient = getRefundRecipient(input);
  if (!recipient.refundBankName || !recipient.refundAccountNumber || !recipient.refundAccountName) {
    throw new AppError(400, "REFUND_RECIPIENT_REQUIRED", "Refund bank account information is required");
  }
  return recipient;
}

class BookingService {
  constructor({ repository, config, outboxWorker }) {
    this.repository = repository;
    this.config = config;
    this.outboxWorker = outboxWorker;
    this.redisClient = getRedisClient({ redisUrl: config.redisUrl, logger: config.logger });
  }

  async holdSlot(input, actor, meta) {
    const idempotencyKey = meta.idempotencyKey || null;
    let claimedIdempotency = false;

    if (!this.redisClient) {
      throw new AppError(503, "REDIS_UNAVAILABLE", "Redis is required for distributed lock / idempotency");
    }

    const segments = normalizeHoldSegments(input);
    assertSegmentsNotInPast(input, segments);

    const idempotencyRedisKey = idempotencyKey
      ? redisKey(`idem:booking:${idempotencyKey}`, { redisPrefix: this.config.redisPrefix })
      : null;

    // 1) Idempotency pre-check
    if (idempotencyRedisKey) {
      try {
        const existing = await idempotencyStore.get(this.redisClient, idempotencyRedisKey);
        if (existing?.state === idempotencyStore.STATE_PROCESSING) {
          throw new AppError(409, "IDEMPOTENCY_IN_PROGRESS", "Request is already being processed");
        }
        if (existing?.state === "SUCCESS") {
          return existing.payload;
        }

        const claimed = await idempotencyStore.claimProcessing(this.redisClient, idempotencyRedisKey, this.config.idempotencyTtlMs);
        if (!claimed) {
          // Someone else raced and claimed; re-check state.
          const raced = await idempotencyStore.get(this.redisClient, idempotencyRedisKey);
          if (raced?.state === idempotencyStore.STATE_PROCESSING) {
            throw new AppError(409, "IDEMPOTENCY_IN_PROGRESS", "Request is already being processed");
          }
          if (raced?.state === "SUCCESS") {
            return raced.payload;
          }
          throw new AppError(409, "IDEMPOTENCY_CONFLICT", "Idempotency key is in an unexpected state");
        }

        // We own this idempotency key for the remainder of the flow.
        claimedIdempotency = true;
      } catch (error) {
        if (error instanceof AppError) throw error;
        if (claimedIdempotency) {
          try {
            await idempotencyStore.del(this.redisClient, idempotencyRedisKey);
          } catch {
            // Ignore cleanup errors.
          }
        }
        this.config.logger.error("Booking idempotency failed", { reason: error.message });
        throw new AppError(503, "REDIS_UNAVAILABLE", "Redis error for idempotency");
      }
    }

    const lockSuffix =
      segments.length === 1
        ? `${segments[0].startTime}:${segments[0].endTime}`
        : `multi:${segments.map((s) => `${s.startTime}-${s.endTime}`).sort().join("|")}`;

    // 2) Distributed lock (một hoặc nhiều khung giờ)
    const lockRedisKey = redisKey(`lock:slot:${input.courtId}:${input.date}:${lockSuffix}`, {
      redisPrefix: this.config.redisPrefix,
    });
    let lockToken = null;
    try {
      lockToken = await acquireLock({ client: this.redisClient, key: lockRedisKey, ttlMs: this.config.holdTtlMs });
      if (!lockToken) {
        throw new AppError(423, "SLOT_LOCK_CONFLICT", "Slot is currently being held/processed");
      }
    } catch (error) {
      if (claimedIdempotency) {
        try {
          await idempotencyStore.del(this.redisClient, idempotencyRedisKey);
        } catch {
          // Ignore cleanup errors; main error is what client needs.
        }
      }
      if (error instanceof AppError) throw error;
      this.config.logger.error("Booking lock acquire failed", { reason: error.message });
      throw new AppError(503, "REDIS_UNAVAILABLE", "Redis error for distributed lock");
    }

    let result;
    try {
      const quote = await this.quoteHoldSegments(input, segments, meta.correlationId);
      const enrichedInput = {
        ...input,
        startTime: segments[0].startTime,
        endTime: segments[segments.length - 1].endTime,
      };
      result = await this.repository.createHoldBooking({
        input: enrichedInput,
        segments,
        actor,
        quote,
        holdTtlMs: this.config.holdTtlMs,
      });
      await this.invalidateAvailability(input.courtId, meta.correlationId);

      // 3) Save idempotency success payload
      if (idempotencyRedisKey) {
        await idempotencyStore.setSuccess(this.redisClient, idempotencyRedisKey, result, this.config.idempotencyTtlMs);
      }

      return result;
    } catch (error) {
      if (idempotencyRedisKey) {
        // Ensure failures don't permanently poison the idempotency key.
        try {
          await idempotencyStore.del(this.redisClient, idempotencyRedisKey);
        } catch {
          // Ignore cleanup errors; main error is what's returned to client.
        }
      }
      throw error;
    } finally {
      if (lockToken) {
        try {
          await releaseLock({ client: this.redisClient, key: lockRedisKey, token: lockToken });
        } catch {
          // Ignore unlock errors; lock has TTL so it will expire.
        }
      }
    }
  }

  async createBooking(bookingId, actor, meta) {
    const booking = await this.mustGetOwnedBooking(bookingId, actor);
    if (booking.status !== BOOKING_STATES.PENDING_HOLD) {
      throw new AppError(409, "INVALID_BOOKING_STATE", "Booking is not in PENDING_HOLD state");
    }
    if (booking.holdExpiredAt && new Date(booking.holdExpiredAt).getTime() <= Date.now()) {
      await this.expireBooking(booking);
      throw new AppError(409, "HOLD_EXPIRED", "Hold already expired");
    }

    const updated = await this.repository.markPendingPayment(bookingId, actor.sub);
    const event = createEvent("booking.created", updated.id, meta.correlationId, {
      bookingId: updated.id,
      userId: updated.userId,
      totalAmount: updated.totalAmount,
      paymentScenario: updated.paymentScenario,
      type: "booking",
    });
    await this.recordAndPublish(event);
    return this.repository.findBooking(updated.id);
  }

  async getBooking(bookingId, actor) {
    return this.mustGetOwnedBooking(bookingId, actor);
  }

  async getHistory(actor, query = {}) {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
    const status = query.status || undefined;
    const date = query.date || undefined;
    const userId = query.userId || undefined;
    const opts = { page, limit, status, date };

    if (actor.roles.includes("admin") || actor.roles.includes("staff")) {
      return this.repository.listAllBookings({ ...opts, userId, limit: Math.min(1000, limit || 1000) });
    }
    return this.repository.listBookingsByUser(actor.sub, opts);
  }

  async staffCreateBooking(input, actor, meta) {
    if (!actor.roles.includes("admin") && !actor.roles.includes("staff")) {
      throw new AppError(403, "FORBIDDEN", "Staff or admin role required");
    }

    const manualCustomerName = (input.customerName || "").trim() || "Vãng lai";
    const paymentScenario = {
      providerStatus: input.paymentScenario?.providerStatus || (input.billStatus === "paid" ? "success" : "fail"),
      autoWebhook: false,
      manualCustomerName,
      customerPhone: input.customerPhone || null,
    };

    const segments = normalizeHoldSegments(input);
    const quote = await this.quoteHoldSegments(input, segments, meta.correlationId);
    const holdResult = await this.repository.createHoldBooking({
      input: { ...input, origin: input.origin || "staff_manual", paymentScenario },
      segments,
      actor: { sub: input.userId || actor.sub },
      quote,
      holdTtlMs: this.config.holdTtlMs,
    });

    const bookingId = holdResult.booking.id;
    const pending = await this.repository.markPendingPayment(bookingId, actor.sub);
    let resultBooking = pending;
    if (input.billStatus === "paid") {
      resultBooking = await this.repository.confirmBooking(bookingId, "STAFF_MANUAL_CREATE");
    }
    await this.invalidateAvailability(input.courtId, meta.correlationId);

    const event = createEvent(input.billStatus === "paid" ? "booking.confirmed" : "booking.created", bookingId, meta.correlationId, {
      bookingId,
      userId: input.userId || actor.sub,
      type: "staff_manual",
    });
    await this.recordAndPublish(event);
    return this.repository.findBooking(resultBooking.id);
  }

  async cancelBooking(bookingId, actor, meta) {
    const booking = await this.mustGetOwnedBooking(bookingId, actor, true);
    const staffOrAdmin = actor.roles?.some((r) => ["admin", "staff"].includes(r));
    if (staffOrAdmin) {
      if (![BOOKING_STATES.CONFIRMED, BOOKING_STATES.PENDING_PAYMENT].includes(booking.status)) {
        throw new AppError(409, "INVALID_BOOKING_STATE", "Booking cannot be cancelled from current state");
      }
    } else if (![BOOKING_STATES.CONFIRMED, BOOKING_STATES.PENDING_PAYMENT].includes(booking.status)) {
      throw new AppError(
        409,
        "INVALID_BOOKING_STATE",
        "Chỉ có thể hủy booking đang chờ thanh toán."
      );
    }

    const refundAmount = booking.status === BOOKING_STATES.CONFIRMED ? this.calculateRefund(booking) : 0;
    const refundRecipient = assertRefundRecipient(refundAmount, meta);
    const status = refundAmount > 0 ? BOOKING_STATES.REFUND_PENDING : BOOKING_STATES.CANCELLED;
    const updated = await this.repository.cancelBooking({
      booking,
      status,
      cancelledBy: actor.sub,
      cancelReason: meta.cancelReason || "customer_request",
      refundAmount,
      refundRecipient,
    });
    await this.invalidateAvailability(booking.courtId, meta.correlationId);

    const event = createEvent("booking.cancelled", updated.id, meta.correlationId, {
      bookingId: updated.id,
      userId: updated.userId,
      refundAmount,
      type: "booking",
      ...getRefundRecipient(refundRecipient),
    });
    await this.recordAndPublish(event);
    return this.repository.findBooking(updated.id);
  }

  async rescheduleBooking(bookingId, input, actor, meta) {
    const booking = await this.mustGetOwnedBooking(bookingId, actor, true);
    if (booking.status !== BOOKING_STATES.CONFIRMED) {
      throw new AppError(409, "INVALID_BOOKING_STATE", "Only CONFIRMED booking can be rescheduled");
    }
    this.assertRescheduleWindowOpen(booking);

    const quote = await this.quote(input, meta.correlationId);
    const draft = await this.repository.createRescheduleDraft({
      booking,
      input,
      quote,
      actorId: actor.sub,
      holdTtlMs: this.config.holdTtlMs,
    });
    await this.invalidateAvailability(booking.courtId, meta.correlationId);
    await this.invalidateAvailability(input.courtId, meta.correlationId);

    if (draft.delta <= 0) {
      const refundRecipient = draft.delta < 0 ? assertRefundRecipient(Math.abs(draft.delta), input) : null;
      const finalized = await this.repository.finalizeRescheduleSuccess(booking.id);
      if (draft.delta < 0) {
        const refundEvent = createEvent("booking.cancelled", booking.id, meta.correlationId, {
          bookingId: booking.id,
          userId: booking.userId,
          refundAmount: Math.abs(draft.delta),
          type: "reschedule_refund",
          ...getRefundRecipient(refundRecipient),
        });
        await this.recordAndPublish(refundEvent);
      }
      const event = createEvent("booking.rescheduled", booking.id, meta.correlationId, {
        bookingId: booking.id,
        userId: booking.userId,
        delta: draft.delta,
      });
      await this.recordAndPublish(event);
      return this.repository.findBooking(finalized.id);
    }

    const event = createEvent("booking.reschedule_requested", booking.id, meta.correlationId, {
      bookingId: booking.id,
      userId: booking.userId,
      totalAmount: draft.delta,
      paymentScenario: input.paymentScenario || booking.paymentScenario,
      type: "reschedule",
    });
    await this.recordAndPublish(event);
    return this.repository.findBooking(booking.id);
  }

  assertRescheduleWindowOpen(booking) {
    const start = new Date(`${booking.date}T${booking.startTime}:00`).getTime();
    const diffHours = (start - Date.now()) / (60 * 60 * 1000);
    const rescheduleBeforeHours = booking.policySnapshot?.rescheduleBeforeHours ?? 6;
    if (diffHours < rescheduleBeforeHours) {
      throw new AppError(
        409,
        "RESCHEDULE_WINDOW_CLOSED",
        `Booking can only be rescheduled at least ${rescheduleBeforeHours} hours before start time`
      );
    }
  }

  async checkIn(bookingId, actor) {
    const booking = await this.mustGetOwnedBooking(bookingId, actor, true);
    if (booking.status !== BOOKING_STATES.CONFIRMED) {
      throw new AppError(409, "INVALID_BOOKING_STATE", "Only CONFIRMED booking can be checked in");
    }

    const updated = await this.repository.checkIn(bookingId, actor.sub);
    return this.repository.findBooking(updated.id);
  }

  async completeBooking(bookingId, actor) {
    const booking = await this.mustGetOwnedBooking(bookingId, actor, true);
    if (booking.status !== BOOKING_STATES.CHECKED_IN) {
      throw new AppError(409, "INVALID_BOOKING_STATE", "Only CHECKED_IN booking can be completed");
    }
    const updated = await this.repository.completeBooking(bookingId, actor.sub);
    return this.repository.findBooking(updated.id);
  }

  async staffConfirmPayment(bookingId, actor) {
    if (!actor.roles.includes("admin") && !actor.roles.includes("staff")) {
      throw new AppError(403, "FORBIDDEN", "Staff or admin role required");
    }
    const booking = await this.repository.findBooking(bookingId);
    if (!booking) throw new AppError(404, "BOOKING_NOT_FOUND", "Booking not found");
    if (booking.status !== BOOKING_STATES.PENDING_PAYMENT) {
      throw new AppError(409, "INVALID_BOOKING_STATE", "Only PENDING_PAYMENT booking can be confirmed");
    }
    const updated = await this.repository.confirmBooking(bookingId, "STAFF_CONFIRM_PAYMENT");
    await this.invalidateAvailability(updated.courtId, null);
    const event = createEvent("booking.confirmed", bookingId, null, {
      bookingId,
      userId: booking.userId,
      type: "staff_confirm",
    });
    await this.recordAndPublish(event);
    return this.repository.findBooking(updated.id);
  }

  async staffProcessRefund(bookingId, actor) {
    if (!actor.roles.includes("admin") && !actor.roles.includes("staff")) {
      throw new AppError(403, "FORBIDDEN", "Staff or admin role required");
    }
    const booking = await this.repository.findBooking(bookingId);
    if (!booking) throw new AppError(404, "BOOKING_NOT_FOUND", "Booking not found");
    if (booking.status !== BOOKING_STATES.REFUND_PENDING) {
      throw new AppError(409, "INVALID_BOOKING_STATE", "Only REFUND_PENDING booking can be refunded");
    }
    await this.repository.markRefunded(bookingId, booking.totalAmount);
    const event = createEvent("booking.refunded", bookingId, null, {
      bookingId,
      userId: booking.userId,
      amount: booking.totalAmount,
    });
    await this.recordAndPublish(event);
    return this.repository.findBooking(bookingId);
  }

  async markNoShow(bookingId, actor) {
    if (!actor.roles.includes("admin") && !actor.roles.includes("staff")) {
      throw new AppError(403, "FORBIDDEN", "Staff or admin role required");
    }
    const booking = await this.repository.findBooking(bookingId);
    if (!booking) throw new AppError(404, "BOOKING_NOT_FOUND", "Booking not found");
    if (booking.status !== BOOKING_STATES.CONFIRMED) {
      throw new AppError(409, "INVALID_BOOKING_STATE", "Only CONFIRMED booking can be marked no-show");
    }
    const updated = await this.repository.failBooking(bookingId, BOOKING_STATES.CANCELLED, "NO_SHOW");
    await this.invalidateAvailability(updated.courtId, null);
    return this.repository.findBooking(updated.id);
  }

  async markPaymentCompleted(payload) {
    const booking = await this.repository.findBooking(payload.bookingId);
    if (!booking) {
      return;
    }

    if (payload.type === "reschedule" && booking.rescheduleContext) {
      const transition = resolveBookingTransition("COMPLETED", "reschedule");
      if (transition && !transition.from.includes(booking.status)) {
        this.config.logger.warn("Ignoring payment.completed for reschedule: booking not in expected state", {
          bookingId: booking.id, currentStatus: booking.status, expectedFrom: transition.from,
        });
        return;
      }
      const updated = await this.repository.finalizeRescheduleSuccess(booking.id);
      await this.invalidateAvailability(booking.courtId, payload.correlationId);
      await this.invalidateAvailability(updated.courtId, payload.correlationId);
      const event = createEvent("booking.rescheduled", booking.id, payload.correlationId, {
        bookingId: booking.id,
        userId: booking.userId,
        delta: booking.rescheduleContext.delta,
      });
      await this.recordAndPublish(event);
      return;
    }

    const transition = resolveBookingTransition("COMPLETED", "booking");
    if ([BOOKING_STATES.CONFIRMED, BOOKING_STATES.CHECKED_IN, BOOKING_STATES.COMPLETED].includes(booking.status)) {
      return;
    }
    if (transition && !transition.from.includes(booking.status)) {
      this.config.logger.warn("Ignoring payment.completed: booking not in expected state", {
        bookingId: booking.id, currentStatus: booking.status, expectedFrom: transition.from,
      });
      return;
    }

    const updated = await this.repository.confirmBooking(booking.id);
    await this.invalidateAvailability(updated.courtId, payload.correlationId);

    const event = createEvent("booking.confirmed", booking.id, payload.correlationId, {
      bookingId: booking.id,
      userId: booking.userId,
      type: payload.type,
    });
    await this.recordAndPublish(event);
  }

  async markPaymentFailed(payload) {
    const booking = await this.repository.findBooking(payload.bookingId);
    if (!booking) {
      return;
    }

    if (payload.type === "reschedule" && booking.rescheduleContext) {
      const transition = resolveBookingTransition("FAILED", "reschedule");
      if (transition && !transition.from.includes(booking.status)) {
        this.config.logger.warn("Ignoring payment.failed for reschedule: booking not in expected state", {
          bookingId: booking.id, currentStatus: booking.status,
        });
        return;
      }
      const rolledBack = await this.repository.rollbackReschedule(booking.id);
      await this.invalidateAvailability(booking.courtId, payload.correlationId);
      await this.invalidateAvailability(booking.rescheduleContext.newCourtId, payload.correlationId);
      return rolledBack;
    }

    const transition = resolveBookingTransition("FAILED", "booking");
    if (transition && !transition.from.includes(booking.status)) {
      this.config.logger.warn("Ignoring payment.failed: booking not in expected state", {
        bookingId: booking.id, currentStatus: booking.status, expectedFrom: transition.from,
      });
      return;
    }

    const reason = payload.reason || transition?.reason || "PAYMENT_FAILED";
    const updated = await this.repository.failBooking(booking.id, BOOKING_STATES.CANCELLED, reason);
    await this.invalidateAvailability(updated.courtId, payload.correlationId);
  }

  async markRefundCompleted(payload) {
    const booking = await this.repository.findBooking(payload.bookingId);
    if (!booking || booking.status !== BOOKING_STATES.REFUND_PENDING) {
      return;
    }

    await this.repository.markRefunded(booking.id, payload.amount);
    const event = createEvent("booking.refunded", booking.id, payload.correlationId, {
      bookingId: booking.id,
      userId: booking.userId,
      amount: payload.amount,
    });
    await this.recordAndPublish(event);
  }

  async getReservations(query, internalToken) {
    if (internalToken !== this.config.internalServiceToken) {
      throw new AppError(403, "FORBIDDEN", "Invalid internal token");
    }

    const reservations = await this.repository.listReservations(query);
    return reservations.map((reservation) => ({
      bookingId: reservation.bookingId,
      startTime: reservation.startTime,
      endTime: reservation.endTime,
      status: reservation.status,
    }));
  }

  async sweepExpiredHolds() {
    const expired = await this.repository.findExpiredHolds(new Date());
    for (const booking of expired) {
      await this.expireBooking(booking);
    }
  }

  async expireBooking(booking) {
    const updated = await this.repository.failBooking(booking.id, BOOKING_STATES.EXPIRED, "BOOKING_EXPIRED");
    await this.invalidateAvailability(updated.courtId, null);
    const event = createEvent("booking.expired", booking.id, null, {
      bookingId: booking.id,
      userId: booking.userId,
    });
    await this.recordAndPublish(event);
  }

  calculateRefund(booking) {
    const start = new Date(`${booking.date}T${booking.startTime}:00`).getTime();
    const diffHours = (start - Date.now()) / (60 * 60 * 1000);
    if (diffHours >= (booking.policySnapshot?.refundBeforeHours || 24)) {
      return Math.round(booking.totalAmount * ((booking.policySnapshot?.refundPercent || 100) / 100));
    }
    return 0;
  }

  async quote(input, correlationId) {
    return requestJson("POST", `${this.config.courtServiceUrl}/internal/pricing/quote`, {
      headers: {
        "x-request-id": correlationId || undefined,
      },
      body: input,
    });
  }

  /** Tổng hợp giá từ nhiều khoảng giờ không liền nhau (khớp với nhiều dòng slotReservation). */
  async quoteHoldSegments(baseInput, segments, correlationId) {
    let total = 0;
    const segmentQuotes = [];
    let policySnapshot = null;
    for (const seg of segments) {
      const q = await this.quote(
        {
          courtId: baseInput.courtId,
          date: baseInput.date,
          startTime: seg.startTime,
          endTime: seg.endTime,
        },
        correlationId
      );
      total += q.price;
      segmentQuotes.push({ segment: seg, price: q.price, pricingSnapshot: q.pricingSnapshot });
      if (!policySnapshot) policySnapshot = q.policySnapshot;
    }
    return {
      courtId: baseInput.courtId,
      date: baseInput.date,
      price: total,
      pricingSnapshot: { segments: segmentQuotes },
      policySnapshot,
    };
  }

  async invalidateAvailability(courtId, correlationId) {
    try {
      await requestJson("POST", `${this.config.courtServiceUrl}/internal/cache/invalidate`, {
        headers: {
          "x-internal-token": this.config.internalServiceToken,
          "x-request-id": correlationId || undefined,
        },
        body: { courtId },
      });
    } catch (error) {
      this.config.logger.warn("Court availability invalidation skipped", { reason: error.message, courtId });
    }
  }

  async recordAndPublish(event) {
    await this.repository.saveOutbox(event);
    if (this.outboxWorker) {
      this.outboxWorker.wakeUp();
    }
  }

  async invalidateCourtAvailability(courtId, correlationId) {
    await this.invalidateAvailability(courtId, correlationId);
  }

  async mustGetOwnedBooking(bookingId, actor, allowStaffOverride = false) {
    const booking = await this.repository.findBooking(bookingId);
    if (!booking) {
      throw new AppError(404, "BOOKING_NOT_FOUND", "Booking not found");
    }

    if (!allowStaffOverride && booking.userId !== actor.sub && !actor.roles.includes("admin") && !actor.roles.includes("staff")) {
      throw new AppError(403, "FORBIDDEN", "You do not own this booking");
    }

    return booking;
  }
}

module.exports = {
  BookingService,
};
