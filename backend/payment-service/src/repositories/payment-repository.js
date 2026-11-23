const { prisma } = require("../../../shared/data/prisma");

function buildRefundReference(refundId) {
  return `RF${refundId.replace(/[^0-9A-Za-z]/g, "").toUpperCase().slice(0, 16).padEnd(16, "0")}`;
}

class PaymentRepository {
  async createPayment(input) {
    return prisma.payment.create({
      data: {
        bookingId: input.bookingId,
        userId: input.userId,
        amount: input.amount,
        type: input.type,
        status: input.status,
        providerReference: input.providerReference,
        providerStatus: input.providerStatus,
        expiresAt: input.expiresAt,
      },
    });
  }

  async updatePayment(id, changes) {
    return prisma.payment.update({
      where: { id },
      data: changes,
    });
  }

  async findPayment(id) {
    return prisma.payment.findUnique({ where: { id } });
  }

  async findPaymentByProviderRef(providerReference) {
    return prisma.payment.findFirst({
      where: { providerReference, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
  }

  async findPaymentByBooking(bookingId, type) {
    return prisma.payment.findFirst({
      where: { bookingId, type },
      orderBy: { createdAt: "desc" },
    });
  }

  async findBookingForPayment(bookingId) {
    return prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        userId: true,
        totalAmount: true,
        policySnapshot: true,
      },
    });
  }

  async listTimedOutPending(now) {
    return prisma.payment.findMany({
      where: {
        status: "PENDING",
        expiresAt: { lte: now },
      },
    });
  }

  async registerProviderTransaction(paymentId, providerTransactionId, status, payload) {
    return prisma.paymentTransaction.create({
      data: {
        paymentId,
        providerTransactionId,
        status,
        payload,
      },
    });
  }

  async createRefund(input) {
    return prisma.$transaction(async (tx) => {
      const refund = await tx.refund.create({
        data: {
          paymentId: input.paymentId,
          bookingId: input.bookingId,
          amount: input.amount,
          reason: input.reason,
          status: "PENDING",
          refundBankName: input.refundBankName,
          refundAccountNumber: input.refundAccountNumber,
          refundAccountName: input.refundAccountName,
          matchWindowExpiresAt: input.matchWindowExpiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      return tx.refund.update({
        where: { id: refund.id },
        data: { refundReference: buildRefundReference(refund.id) },
      });
    });
  }

  async findRefundByReference(refundReference) {
    return prisma.refund.findUnique({
      where: { refundReference },
    });
  }

  async findRefund(refundId) {
    return prisma.refund.findUnique({
      where: { id: refundId },
    });
  }

  async findRefundByProviderTransaction(providerTransactionId) {
    return prisma.refund.findUnique({
      where: { providerTransactionId },
    });
  }

  async listRefundsByPayment(paymentId) {
    return prisma.refund.findMany({
      where: { paymentId },
      orderBy: { createdAt: "desc" },
    });
  }

  async listRefunds({ tab, status, limit = 100 }) {
    const where = {};
    if (status) {
      where.status = status;
    } else if (tab === "needs_transfer") {
      where.status = "PENDING";
      where.manualTransferMarkedAt = null;
      where.lastMismatchReason = null;
    } else if (tab === "waiting_webhook") {
      where.status = "PENDING";
      where.manualTransferMarkedAt = { not: null };
      where.lastMismatchReason = null;
    } else if (tab === "needs_review") {
      where.status = "PENDING";
      where.lastMismatchReason = { not: null };
    } else if (tab === "succeeded") {
      where.status = "SUCCEEDED";
    } else if (tab === "failed") {
      where.status = "FAILED";
    }

    return prisma.refund.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(Number(limit) || 100, 500),
      include: {
        payment: true,
      },
    });
  }

  async markRefundSucceeded(refundId, changes) {
    return prisma.refund.update({
      where: { id: refundId },
      data: {
        status: "SUCCEEDED",
        providerTransactionId: changes.providerTransactionId,
        completedAt: changes.completedAt || new Date(),
        completedBy: changes.completedBy || null,
        completedVia: changes.completedVia,
        manualProofNote: changes.manualProofNote || null,
        lastMismatchReason: changes.lastMismatchReason || null,
      },
    });
  }

  async markRefundMismatch(refundId, reason) {
    return prisma.refund.update({
      where: { id: refundId },
      data: { lastMismatchReason: reason },
    });
  }

  async markRefundTransferred(refundId, actorId) {
    return prisma.refund.update({
      where: { id: refundId },
      data: {
        manualTransferMarkedAt: new Date(),
        manualTransferMarkedBy: actorId,
      },
    });
  }

  async markRefundFailed(refundId, failureReason) {
    return prisma.refund.update({
      where: { id: refundId },
      data: {
        status: "FAILED",
        failureReason,
      },
    });
  }

  async saveWebhookLog(entry) {
    const payload = entry.input || {};
    return prisma.paymentWebhookLog.create({
      data: {
        provider: "sepay",
        providerTransactionId: payload.id ? String(payload.id) : payload.transactionId ? String(payload.transactionId) : null,
        referenceCode: payload.referenceCode || null,
        transferType: payload.transferType || null,
        transferAmount: payload.transferAmount || payload.amount ? Number(payload.transferAmount || payload.amount) : null,
        content: payload.content || payload.transferContent || payload.description || null,
        matchedType: entry.matchedType,
        matchedPaymentId: entry.matchedPaymentId || null,
        matchedRefundId: entry.matchedRefundId || null,
        result: entry.result,
        rawPayload: payload,
      },
    });
  }

  async saveOutbox(event) {
    return prisma.paymentOutboxEvent.create({
      data: {
        eventId: event.event_id,
        eventType: event.event_type,
        aggregateId: event.aggregate_id,
        schemaVersion: event.schema_version,
        correlationId: event.correlation_id || null,
        payload: event.payload,
      },
    });
  }

  async getUnpublishedOutboxEvents({ limit = 50 }) {
    return prisma.paymentOutboxEvent.findMany({
      where: { publishedAt: null },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
  }

  async markOutboxPublished(eventId) {
    return prisma.paymentOutboxEvent.update({
      where: { eventId },
      data: { publishedAt: new Date() },
    });
  }
}

module.exports = {
  PaymentRepository,
};
