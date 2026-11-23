const { Prisma } = require("../../../shared/generated/prisma");
const { AppError } = require("../../../shared/lib/errors");
const { createEvent } = require("../../../shared/events/envelope");
const { PAYMENT_STATES } = require("../../../shared/constants/booking");
const { getRedisClient, redisKey } = require("../../../shared/lib/redis");
const idempotencyStore = require("../../../shared/lib/idempotency-store");

class PaymentService {
  constructor({ repository, config, outboxWorker, provider }) {
    this.repository = repository;
    this.config = config;
    this.outboxWorker = outboxWorker;
    this.provider = provider;
    this.redisClient = getRedisClient({ redisUrl: config.redisUrl, logger: config.logger });
  }

  async createPaymentOrder(input, correlationId) {
    const idempotencyKey = input.idempotencyKey || null;
    const idempotencyRedisKey = idempotencyKey
      ? redisKey(`idem:payment:${idempotencyKey}`, { redisPrefix: this.config.redisPrefix })
      : null;
    let claimedIdempotency = false;

    // 1) Idempotency pre-check
    if (idempotencyRedisKey) {
      if (!this.redisClient) {
        throw new AppError(503, "REDIS_UNAVAILABLE", "Redis is required for payment idempotency");
      }

      try {
        const existing = await idempotencyStore.get(this.redisClient, idempotencyRedisKey);
        if (existing?.state === idempotencyStore.STATE_PROCESSING) {
          throw new AppError(409, "IDEMPOTENCY_IN_PROGRESS", "Payment request is already being processed");
        }
        if (existing?.state === "SUCCESS") {
          return existing.payload;
        }

        const claimed = await idempotencyStore.claimProcessing(this.redisClient, idempotencyRedisKey, this.config.idempotencyTtlMs);
        if (!claimed) {
          const raced = await idempotencyStore.get(this.redisClient, idempotencyRedisKey);
          if (raced?.state === idempotencyStore.STATE_PROCESSING) {
            throw new AppError(409, "IDEMPOTENCY_IN_PROGRESS", "Payment request is already being processed");
          }
          if (raced?.state === "SUCCESS") return raced.payload;
          throw new AppError(409, "IDEMPOTENCY_CONFLICT", "Idempotency key is in an unexpected state");
        }

        claimedIdempotency = true;
      } catch (error) {
        if (error instanceof AppError) throw error;
        if (claimedIdempotency) {
          try {
            await idempotencyStore.del(this.redisClient, idempotencyRedisKey);
          } catch {
            // Ignore cleanup errors; main error is what client needs.
          }
        }
        this.config.logger.error("Payment idempotency failed", { reason: error.message });
        throw new AppError(503, "REDIS_UNAVAILABLE", "Redis error for payment idempotency");
      }
    }

    // 2) DB dedup check
    const booking = await this.repository.findBookingForPayment(input.bookingId);
    if (!booking) {
      throw new AppError(404, "BOOKING_NOT_FOUND", "Booking not found");
    }

    const totalAmount = Number(booking.totalAmount || 0);
    const resolvedAmount = totalAmount;

    const existing = await this.repository.findPaymentByBooking(input.bookingId, input.type || "booking");
    if (existing && [PAYMENT_STATES.PENDING, PAYMENT_STATES.COMPLETED].includes(existing.status)) {
      // Re-hydrate transient QR/bank fields so the client always gets them
      if (this.provider.name === "sepay" && existing.providerReference) {
        const bankInfo = {
          bankCode: this.config.sepayBankCode || "TPBANK",
          accountNumber: this.config.sepayAccountNumber,
          accountName: this.config.sepayAccountName,
          amount: existing.amount,
          transferContent: existing.providerReference,
        };
        existing.qrDataUrl = this.provider._buildQrUrl(existing.amount, existing.providerReference);
        existing.bankInfo = bankInfo;
        existing.transferContent = existing.providerReference;
      }

      if (idempotencyRedisKey) {
        // Persist SUCCESS so duplicates get same response.
        try {
          await idempotencyStore.setSuccess(this.redisClient, idempotencyRedisKey, existing, this.config.idempotencyTtlMs);
        } catch (error) {
          this.config.logger.error("Failed to persist payment idempotency success", { reason: error.message });
          if (claimedIdempotency) {
            try {
              await idempotencyStore.del(this.redisClient, idempotencyRedisKey);
            } catch {
              // Ignore cleanup errors.
            }
          }
          throw new AppError(503, "REDIS_UNAVAILABLE", "Redis error for payment idempotency");
        }
      }
      return existing;
    }

    let payment;
    try {
      const providerOrder = await this.provider.createOrder({
        id: input.bookingId,
        amount: resolvedAmount,
        providerStatus: input.paymentScenario?.providerStatus || "success",
      });

      payment = await this.repository.createPayment({
        bookingId: input.bookingId,
        userId: booking.userId || input.userId,
        amount: resolvedAmount,
        type: input.type || "booking",
        status: PAYMENT_STATES.PENDING,
        providerStatus: providerOrder.providerStatus || "pending",
        providerReference: providerOrder.providerReference,
        expiresAt: new Date(Date.now() + this.config.paymentTimeoutMs),
      });

      payment.qrDataUrl = providerOrder.qrDataUrl || null;
      payment.bankInfo = providerOrder.bankInfo || null;
      payment.transferContent = providerOrder.transferContent || null;

      const event = createEvent("payment.order_created", payment.id, correlationId, {
        paymentId: payment.id,
        bookingId: payment.bookingId,
        amount: payment.amount,
        type: payment.type,
      });
      await this.recordAndPublish(event);

      if (this.provider.name === "mock" && input.paymentScenario?.autoWebhook) {
        setTimeout(() => {
          const signature = this.config.signWebhook(`${payment.id}:${input.paymentScenario.providerStatus}:PTRX-${payment.id}`);
          this.processWebhook(
            {
              paymentId: payment.id,
              status: input.paymentScenario.providerStatus,
              providerTransactionId: `PTRX-${payment.id}`,
            },
            { "x-mock-signature": signature },
            correlationId
          ).catch((error) => {
            this.config.logger.error("Auto webhook failed", { reason: error.message, paymentId: payment.id });
          });
        }, 1500);
      }

      if (idempotencyRedisKey) {
        try {
          await idempotencyStore.setSuccess(this.redisClient, idempotencyRedisKey, payment, this.config.idempotencyTtlMs);
        } catch (error) {
          this.config.logger.error("Failed to persist payment idempotency success", { reason: error.message });
          throw new AppError(503, "REDIS_UNAVAILABLE", "Redis error for payment idempotency");
        }
      }

      return payment;
    } catch (error) {
      if (idempotencyRedisKey) {
        try {
          await idempotencyStore.del(this.redisClient, idempotencyRedisKey);
        } catch {
          // Ignore cleanup errors; main error is what client needs.
        }
      }
      throw error;
    }
  }

  async processWebhook(input, headers, correlationId) {
    if (!this.provider.verifyWebhook(headers, input)) {
      throw new AppError(401, "INVALID_SIGNATURE", "Webhook signature is invalid");
    }

    if (typeof this.provider.classifyCallback === "function") {
      const classification = this.provider.classifyCallback(input);
      if (classification.type === "ignored") {
        await this.recordWebhookBestEffort(input, {
          matchedType: "IGNORED",
          result: classification.reason,
        });
        return { ignored: true, reason: classification.reason };
      }
      if (classification.type === "outgoing_refund") {
        return this.processOutgoingRefundWebhook(input, correlationId);
      }
    }

    return this.processIncomingPaymentWebhook(input, correlationId);
  }

  async processIncomingPaymentWebhook(input, correlationId) {
    const normalized = this.provider.normalizeCallback(input);

    let payment;
    if (normalized.paymentId) {
      payment = await this.repository.findPayment(normalized.paymentId);
    } else if (normalized.transferContent) {
      payment = await this.repository.findPaymentByProviderRef(normalized.transferContent);
    }

    if (!payment) {
      throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
    }

    if (payment.status !== PAYMENT_STATES.PENDING) {
      await this.recordWebhookBestEffort(input, {
        matchedType: "PAYMENT",
        matchedPaymentId: payment.id,
        result: "DUPLICATE_OR_ALREADY_PROCESSED",
      });
      return { deduplicated: true, status: payment.status };
    }

    try {
      await this.repository.registerProviderTransaction(payment.id, normalized.providerTransactionId, normalized.status, input);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        await this.recordWebhookBestEffort(input, {
          matchedType: "PAYMENT",
          matchedPaymentId: payment.id,
          result: "DUPLICATE",
        });
        return { deduplicated: true };
      }
      throw error;
    }

    const nextStatus = normalized.status === "success" ? PAYMENT_STATES.COMPLETED : PAYMENT_STATES.FAILED;
    await this.repository.updatePayment(payment.id, {
      status: nextStatus,
      providerTransactionId: normalized.providerTransactionId,
    });

    const event = createEvent(nextStatus === PAYMENT_STATES.COMPLETED ? "payment.completed" : "payment.failed", payment.id, correlationId, {
      paymentId: payment.id,
      bookingId: payment.bookingId,
      type: payment.type,
    });
    await this.recordAndPublish(event);
    await this.recordWebhookBestEffort(input, {
      matchedType: "PAYMENT",
      matchedPaymentId: payment.id,
      result: "MATCHED",
    });
    return { status: nextStatus };
  }

  async processOutgoingRefundWebhook(input, correlationId) {
    const normalized = this.provider.normalizeOutgoingRefundCallback(input);
    const existingRefund = await this.repository.findRefundByProviderTransaction?.(normalized.providerTransactionId);
    if (existingRefund) {
      return { deduplicated: true, status: existingRefund.status };
    }

    const refund = await this.repository.findRefundByReference(normalized.refundReference);
    if (!refund) {
      await this.recordWebhookBestEffort(input, {
        matchedType: "REFUND",
        result: "UNKNOWN_REFERENCE",
      });
      return { ignored: true, reason: "UNKNOWN_REFUND_REFERENCE" };
    }

    if (refund.status !== "PENDING") {
      return { deduplicated: true, status: refund.status };
    }

    if (refund.matchWindowExpiresAt && new Date(refund.matchWindowExpiresAt).getTime() < Date.now()) {
      await this.repository.markRefundMismatch(refund.id, "EXPIRED_MATCH_WINDOW");
      await this.recordWebhookBestEffort(input, {
        matchedType: "REFUND",
        matchedRefundId: refund.id,
        result: "EXPIRED_MATCH_WINDOW",
      });
      return { status: "PENDING", reason: "EXPIRED_MATCH_WINDOW" };
    }

    if (Number(normalized.transferAmount) !== Number(refund.amount)) {
      await this.repository.markRefundMismatch(refund.id, "AMOUNT_MISMATCH");
      await this.recordWebhookBestEffort(input, {
        matchedType: "REFUND",
        matchedRefundId: refund.id,
        result: "AMOUNT_MISMATCH",
      });
      return { status: "PENDING", reason: "AMOUNT_MISMATCH" };
    }

    const payment = await this.repository.findPayment(refund.paymentId);
    if (!payment) {
      throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
    }

    await this.repository.markRefundSucceeded(refund.id, {
      providerTransactionId: normalized.providerTransactionId,
      completedAt: new Date(),
      completedVia: "SEPAY_WEBHOOK",
      lastMismatchReason: null,
    });

    const refundsForPayment = typeof this.repository.listRefundsByPayment === "function"
      ? await this.repository.listRefundsByPayment(payment.id)
      : [refund];
    const succeededRefundTotal = refundsForPayment
      .filter((item) => item.status === "SUCCEEDED" || item.id === refund.id)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const nextPaymentStatus = this.resolvePaymentRefundStatus(payment, succeededRefundTotal);
    await this.repository.updatePayment(payment.id, { status: nextPaymentStatus });

    const event = createEvent("payment.refund_completed", refund.id, correlationId, {
      bookingId: refund.bookingId,
      paymentId: payment.id,
      refundId: refund.id,
      amount: refund.amount,
    });
    await this.recordAndPublish(event);
    await this.recordWebhookBestEffort(input, {
      matchedType: "REFUND",
      matchedRefundId: refund.id,
      result: "MATCHED",
    });
    return { status: "SUCCEEDED" };
  }

  async markRefundTransferred(refundId, actor) {
    this.assertStaffOrAdmin(actor);
    const refund = await this.repository.findRefund(refundId);
    if (!refund) {
      throw new AppError(404, "REFUND_NOT_FOUND", "Refund not found");
    }
    if (refund.status !== "PENDING") {
      throw new AppError(409, "INVALID_REFUND_STATE", "Only pending refunds can be marked transferred");
    }
    return this.repository.markRefundTransferred(refundId, actor.sub);
  }

  async listRefunds(query, actor) {
    this.assertStaffOrAdmin(actor);
    return this.repository.listRefunds({
      tab: query.tab,
      status: query.status,
      limit: query.limit,
    });
  }

  async manualCompleteRefund(refundId, input, actor, correlationId) {
    this.assertAdmin(actor);
    const refund = await this.repository.findRefund(refundId);
    if (!refund) {
      throw new AppError(404, "REFUND_NOT_FOUND", "Refund not found");
    }
    if (refund.status !== "PENDING") {
      throw new AppError(409, "INVALID_REFUND_STATE", "Only pending refunds can be completed");
    }
    if (!input.providerTransactionId && !input.manualProofNote) {
      throw new AppError(400, "MANUAL_PROOF_REQUIRED", "Manual completion requires transaction reference or proof note");
    }

    const payment = await this.repository.findPayment(refund.paymentId);
    if (!payment) {
      throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
    }

    const completedRefund = await this.repository.markRefundSucceeded(refund.id, {
      providerTransactionId: input.providerTransactionId || null,
      completedAt: new Date(),
      completedBy: actor.sub,
      completedVia: "MANUAL_OVERRIDE",
      manualProofNote: input.manualProofNote || null,
      lastMismatchReason: null,
    });

    const refundsForPayment = typeof this.repository.listRefundsByPayment === "function"
      ? await this.repository.listRefundsByPayment(payment.id)
      : [completedRefund];
    const succeededRefundTotal = refundsForPayment
      .filter((item) => item.status === "SUCCEEDED" || item.id === completedRefund.id)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    await this.repository.updatePayment(payment.id, {
      status: this.resolvePaymentRefundStatus(payment, succeededRefundTotal),
    });

    const event = createEvent("payment.refund_completed", refund.id, correlationId, {
      bookingId: refund.bookingId,
      paymentId: payment.id,
      refundId: refund.id,
      amount: refund.amount,
    });
    await this.recordAndPublish(event);
    return completedRefund;
  }

  async failRefund(refundId, input, actor) {
    this.assertAdmin(actor);
    if (!input.failureReason) {
      throw new AppError(400, "FAILURE_REASON_REQUIRED", "Failure reason is required");
    }
    const refund = await this.repository.findRefund(refundId);
    if (!refund) {
      throw new AppError(404, "REFUND_NOT_FOUND", "Refund not found");
    }
    if (refund.status !== "PENDING") {
      throw new AppError(409, "INVALID_REFUND_STATE", "Only pending refunds can be failed");
    }
    return this.repository.markRefundFailed(refundId, input.failureReason);
  }

  async retryRefund(refundId, input, actor, correlationId) {
    void correlationId;
    this.assertAdmin(actor);
    const refund = await this.repository.findRefund(refundId);
    if (!refund) {
      throw new AppError(404, "REFUND_NOT_FOUND", "Refund not found");
    }
    if (refund.status !== "FAILED") {
      throw new AppError(409, "INVALID_REFUND_STATE", "Only failed refunds can be retried");
    }

    return this.createRefund({
      paymentId: refund.paymentId,
      amount: refund.amount,
      reason: refund.reason,
      refundBankName: input.refundBankName,
      refundAccountNumber: input.refundAccountNumber,
      refundAccountName: input.refundAccountName,
    }, correlationId);
  }

  resolvePaymentRefundStatus(payment, succeededRefundTotal) {
    return succeededRefundTotal >= Number(payment.amount)
      ? PAYMENT_STATES.REFUNDED
      : PAYMENT_STATES.PARTIALLY_REFUNDED;
  }

  assertStaffOrAdmin(actor) {
    if (!actor?.roles?.some((role) => ["admin", "staff"].includes(role))) {
      throw new AppError(403, "FORBIDDEN", "Staff or admin role required");
    }
  }

  assertAdmin(actor) {
    if (!actor?.roles?.includes("admin")) {
      throw new AppError(403, "FORBIDDEN", "Admin role required");
    }
  }

  async getPayment(id) {
    const payment = await this.repository.findPayment(id);
    if (!payment) {
      throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
    }
    return payment;
  }

  async createRefund(input, correlationId) {
    const payment = await this.repository.findPayment(input.paymentId);
    if (!payment) {
      throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
    }
    if (![PAYMENT_STATES.COMPLETED, PAYMENT_STATES.PARTIALLY_REFUNDED].includes(payment.status)) {
      throw new AppError(409, "INVALID_PAYMENT_STATE", "Only completed payments can be refunded");
    }
    if (!input.refundBankName || !input.refundAccountNumber || !input.refundAccountName) {
      throw new AppError(400, "REFUND_RECIPIENT_REQUIRED", "Refund bank account information is required");
    }
    const existingRefunds = typeof this.repository.listRefundsByPayment === "function"
      ? await this.repository.listRefundsByPayment(payment.id)
      : [];
    if (existingRefunds.some((refund) => refund.status === "PENDING")) {
      throw new AppError(409, "REFUND_ALREADY_PENDING", "Payment already has a pending refund");
    }
    const activeRefundTotal = existingRefunds
      .filter((refund) => ["PENDING", "SUCCEEDED"].includes(refund.status))
      .reduce((sum, refund) => sum + Number(refund.amount || 0), 0);
    if (activeRefundTotal + Number(input.amount || 0) > Number(payment.amount || 0)) {
      throw new AppError(409, "REFUND_AMOUNT_EXCEEDS_PAYMENT", "Refund amount exceeds payment amount");
    }

    const refund = await this.repository.createRefund({
      paymentId: payment.id,
      bookingId: payment.bookingId,
      amount: input.amount,
      reason: input.reason || "booking_cancelled",
      refundBankName: input.refundBankName || null,
      refundAccountNumber: input.refundAccountNumber || null,
      refundAccountName: input.refundAccountName || null,
    });

    return refund;
  }

  async handleBookingCreated(payload, correlationId) {
    await this.createPaymentOrder(payload, correlationId);
  }

  async handleBookingCancelled(payload, correlationId) {
    if (!payload.refundAmount || payload.refundAmount <= 0) {
      return;
    }

    const payment = (await this.repository.findPaymentByBooking(payload.bookingId, "booking")) || (await this.repository.findPaymentByBooking(payload.bookingId, "reschedule"));
    if (!payment) {
      return;
    }

    await this.createRefund({
      paymentId: payment.id,
      amount: payload.refundAmount,
      reason: payload.type || "booking_cancelled",
      refundBankName: payload.refundBankName,
      refundAccountNumber: payload.refundAccountNumber,
      refundAccountName: payload.refundAccountName,
    }, correlationId);
  }

  async sweepPendingPayments() {
    const expiredPayments = await this.repository.listTimedOutPending(new Date());
    for (const payment of expiredPayments) {
      await this.repository.updatePayment(payment.id, { status: PAYMENT_STATES.FAILED });
      const event = createEvent("payment.failed", payment.id, null, {
        paymentId: payment.id,
        bookingId: payment.bookingId,
        type: payment.type,
        reason: "PAYMENT_TIMEOUT",
      });
      await this.recordAndPublish(event);
    }
  }

  async recordAndPublish(event) {
    await this.repository.saveOutbox(event);
    if (this.outboxWorker) {
      this.outboxWorker.wakeUp();
    }
  }

  async recordWebhookBestEffort(input, result) {
    if (typeof this.repository.saveWebhookLog !== "function") {
      return;
    }

    try {
      await this.repository.saveWebhookLog({ input, ...result });
    } catch (error) {
      this.config.logger.error("Failed to save payment webhook audit log", { reason: error.message });
    }
  }
}

module.exports = {
  PaymentService,
};
