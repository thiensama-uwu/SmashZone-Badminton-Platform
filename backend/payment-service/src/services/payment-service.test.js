const assert = require("node:assert/strict");
const test = require("node:test");
const { PAYMENT_STATES } = require("../../../shared/constants/booking");
const { SepayProvider } = require("../providers/sepay-provider");
const { PaymentService } = require("./payment-service");

class FakePaymentRepository {
  constructor({ payments = [], refunds = [] } = {}) {
    this.payments = new Map(payments.map((payment) => [payment.id, { ...payment }]));
    this.refunds = new Map(refunds.map((refund) => [refund.id, { ...refund }]));
    this.transactions = new Set();
    this.outbox = [];
    this.mismatches = [];
  }

  async findPayment(id) {
    return this.payments.get(id) || null;
  }

  async findPaymentByProviderRef(providerReference) {
    return [...this.payments.values()].find((payment) => payment.providerReference === providerReference && payment.status === PAYMENT_STATES.PENDING) || null;
  }

  async updatePayment(id, changes) {
    const payment = this.payments.get(id);
    Object.assign(payment, changes);
    return payment;
  }

  async registerProviderTransaction(paymentId, providerTransactionId) {
    if (this.transactions.has(providerTransactionId)) {
      const error = new Error("Unique constraint failed");
      error.code = "P2002";
      throw error;
    }
    this.transactions.add(providerTransactionId);
    return { paymentId, providerTransactionId };
  }

  async findRefundByReference(refundReference) {
    return [...this.refunds.values()].find((refund) => refund.refundReference === refundReference) || null;
  }

  async findRefund(refundId) {
    return this.refunds.get(refundId) || null;
  }

  async findRefundByProviderTransaction(providerTransactionId) {
    return [...this.refunds.values()].find((refund) => refund.providerTransactionId === providerTransactionId) || null;
  }

  async markRefundSucceeded(refundId, changes) {
    const refund = this.refunds.get(refundId);
    Object.assign(refund, changes, { status: "SUCCEEDED" });
    return refund;
  }

  async markRefundMismatch(refundId, reason) {
    const refund = this.refunds.get(refundId);
    refund.lastMismatchReason = reason;
    this.mismatches.push({ refundId, reason });
    return refund;
  }

  async markRefundTransferred(refundId, actorId) {
    const refund = this.refunds.get(refundId);
    refund.manualTransferMarkedAt = new Date();
    refund.manualTransferMarkedBy = actorId;
    return refund;
  }

  async markRefundFailed(refundId, failureReason) {
    const refund = this.refunds.get(refundId);
    refund.status = "FAILED";
    refund.failureReason = failureReason;
    return refund;
  }

  async createRefund(input) {
    const id = `refund_${this.refunds.size + 1}`;
    const refund = {
      id,
      status: "PENDING",
      refundReference: `RF${id.replace(/[^0-9A-Z]/gi, "").toUpperCase().padEnd(16, "0").slice(0, 16)}`,
      matchWindowExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ...input,
    };
    this.refunds.set(id, refund);
    return refund;
  }

  async listRefundsByPayment(paymentId) {
    return [...this.refunds.values()].filter((refund) => refund.paymentId === paymentId);
  }

  async saveOutbox(event) {
    this.outbox.push(event);
    return event;
  }
}

function createService(repository) {
  return new PaymentService({
    repository,
    provider: new SepayProvider({}),
    outboxWorker: null,
    config: {
      redisUrl: "",
      logger: {
        error() {},
        warn() {},
        info() {},
      },
    },
  });
}

test("processWebhook preserves incoming SePay payment confirmation flow", async () => {
  const repository = new FakePaymentRepository({
    payments: [{
      id: "pay_1",
      bookingId: "booking_1",
      amount: 10000,
      type: "booking",
      status: PAYMENT_STATES.PENDING,
      providerReference: "DHCMPTN4WMJ0000R00",
    }],
  });
  const service = createService(repository);

  const result = await service.processWebhook({
    id: 61258838,
    content: "DHCMPTN4WMJ0000R00 FT26152780062026",
    transferType: "in",
    transferAmount: 10000,
    referenceCode: "668V602261525474",
  }, {}, "corr-1");

  assert.equal(result.status, PAYMENT_STATES.COMPLETED);
  assert.equal((await repository.findPayment("pay_1")).status, PAYMENT_STATES.COMPLETED);
  assert.equal(repository.outbox.at(-1).event_type, "payment.completed");
});

test("processWebhook marks matching outgoing SePay refund as succeeded", async () => {
  const repository = new FakePaymentRepository({
    payments: [{
      id: "pay_1",
      bookingId: "booking_1",
      amount: 10000,
      type: "booking",
      status: PAYMENT_STATES.COMPLETED,
      providerReference: "DHCMPTN4WMJ0000R00",
    }],
    refunds: [{
      id: "refund_1",
      paymentId: "pay_1",
      bookingId: "booking_1",
      amount: 10000,
      status: "PENDING",
      refundReference: "RF8F2A91C4D77B40AB",
      matchWindowExpiresAt: new Date(Date.now() + 60_000),
    }],
  });
  const service = createService(repository);

  const result = await service.processWebhook({
    id: 70000001,
    content: "RF8F2A91C4D77B40AB HOAN TIEN",
    transferType: "out",
    transferAmount: 10000,
    referenceCode: "OUT-001",
  }, {}, "corr-2");

  assert.equal(result.status, "SUCCEEDED");
  assert.equal(repository.refunds.get("refund_1").status, "SUCCEEDED");
  assert.equal(repository.refunds.get("refund_1").providerTransactionId, "70000001");
  assert.equal(repository.payments.get("pay_1").status, PAYMENT_STATES.REFUNDED);
  assert.equal(repository.outbox.at(-1).event_type, "payment.refund_completed");
});

test("processWebhook marks payment refunded when cumulative succeeded refunds reach payment amount", async () => {
  const repository = new FakePaymentRepository({
    payments: [{
      id: "pay_1",
      bookingId: "booking_1",
      amount: 10000,
      type: "booking",
      status: PAYMENT_STATES.PARTIALLY_REFUNDED,
      providerReference: "DHCMPTN4WMJ0000R00",
    }],
    refunds: [{
      id: "refund_1",
      paymentId: "pay_1",
      bookingId: "booking_1",
      amount: 8000,
      status: "SUCCEEDED",
      refundReference: "RF8F2A91C4D77B40AB",
      providerTransactionId: "69999999",
    }, {
      id: "refund_2",
      paymentId: "pay_1",
      bookingId: "booking_1",
      amount: 2000,
      status: "PENDING",
      refundReference: "RF9F2A91C4D77B40AB",
      matchWindowExpiresAt: new Date(Date.now() + 60_000),
    }],
  });
  const service = createService(repository);

  await service.processWebhook({
    id: 70000009,
    content: "RF9F2A91C4D77B40AB HOAN TIEN",
    transferType: "out",
    transferAmount: 2000,
  }, {}, "corr-2b");

  assert.equal(repository.payments.get("pay_1").status, PAYMENT_STATES.REFUNDED);
});

test("processWebhook keeps refund pending when outgoing amount mismatches", async () => {
  const repository = new FakePaymentRepository({
    refunds: [{
      id: "refund_1",
      paymentId: "pay_1",
      bookingId: "booking_1",
      amount: 10000,
      status: "PENDING",
      refundReference: "RF8F2A91C4D77B40AB",
      matchWindowExpiresAt: new Date(Date.now() + 60_000),
    }],
  });
  const service = createService(repository);

  const result = await service.processWebhook({
    id: 70000002,
    content: "RF8F2A91C4D77B40AB HOAN TIEN",
    transferType: "out",
    transferAmount: 9000,
  }, {}, "corr-3");

  assert.equal(result.status, "PENDING");
  assert.equal(result.reason, "AMOUNT_MISMATCH");
  assert.equal(repository.refunds.get("refund_1").status, "PENDING");
  assert.equal(repository.refunds.get("refund_1").lastMismatchReason, "AMOUNT_MISMATCH");
  assert.equal(repository.outbox.length, 0);
});

test("processWebhook deduplicates repeated outgoing refund webhook", async () => {
  const repository = new FakePaymentRepository({
    refunds: [{
      id: "refund_1",
      paymentId: "pay_1",
      bookingId: "booking_1",
      amount: 10000,
      status: "SUCCEEDED",
      refundReference: "RF8F2A91C4D77B40AB",
      providerTransactionId: "70000001",
    }],
  });
  const service = createService(repository);

  const result = await service.processWebhook({
    id: 70000001,
    content: "RF8F2A91C4D77B40AB HOAN TIEN",
    transferType: "out",
    transferAmount: 10000,
  }, {}, "corr-4");

  assert.equal(result.deduplicated, true);
  assert.equal(result.status, "SUCCEEDED");
  assert.equal(repository.outbox.length, 0);
});

test("createRefund creates a pending refund without marking payment refunded", async () => {
  const repository = new FakePaymentRepository({
    payments: [{
      id: "pay_1",
      bookingId: "booking_1",
      amount: 10000,
      type: "booking",
      status: PAYMENT_STATES.COMPLETED,
      providerReference: "DHCMPTN4WMJ0000R00",
    }],
  });
  const service = createService(repository);

  const refund = await service.createRefund({
    paymentId: "pay_1",
    amount: 10000,
    reason: "booking_cancelled",
    refundBankName: "TPBank",
    refundAccountNumber: "123456",
    refundAccountName: "NGUYEN VAN A",
  }, "corr-5");

  assert.equal(refund.status, "PENDING");
  assert.match(refund.refundReference, /^RF[0-9A-Z]{16}$/);
  assert.equal(repository.payments.get("pay_1").status, PAYMENT_STATES.COMPLETED);
  assert.equal(repository.outbox.some((event) => event.event_type === "payment.refund_completed"), false);
});

test("createRefund requires refund recipient bank fields", async () => {
  const repository = new FakePaymentRepository({
    payments: [{
      id: "pay_1",
      bookingId: "booking_1",
      amount: 10000,
      type: "booking",
      status: PAYMENT_STATES.COMPLETED,
      providerReference: "DHCMPTN4WMJ0000R00",
    }],
  });
  const service = createService(repository);

  await assert.rejects(
    () => service.createRefund({ paymentId: "pay_1", amount: 10000, reason: "booking_cancelled" }, "corr-6"),
    { code: "REFUND_RECIPIENT_REQUIRED" }
  );
});

test("createRefund rejects a second pending refund for the same payment", async () => {
  const repository = new FakePaymentRepository({
    payments: [{
      id: "pay_1",
      bookingId: "booking_1",
      amount: 10000,
      type: "booking",
      status: PAYMENT_STATES.COMPLETED,
      providerReference: "DHCMPTN4WMJ0000R00",
    }],
    refunds: [{
      id: "refund_1",
      paymentId: "pay_1",
      bookingId: "booking_1",
      amount: 5000,
      status: "PENDING",
      refundReference: "RF8F2A91C4D77B40AB",
    }],
  });
  const service = createService(repository);

  await assert.rejects(
    () => service.createRefund({
      paymentId: "pay_1",
      amount: 5000,
      reason: "booking_cancelled",
      refundBankName: "TPBank",
      refundAccountNumber: "123456",
      refundAccountName: "NGUYEN VAN A",
    }, "corr-7"),
    { code: "REFUND_ALREADY_PENDING" }
  );
});

test("createRefund rejects total pending and succeeded refunds above payment amount", async () => {
  const repository = new FakePaymentRepository({
    payments: [{
      id: "pay_1",
      bookingId: "booking_1",
      amount: 10000,
      type: "booking",
      status: PAYMENT_STATES.PARTIALLY_REFUNDED,
      providerReference: "DHCMPTN4WMJ0000R00",
    }],
    refunds: [{
      id: "refund_1",
      paymentId: "pay_1",
      bookingId: "booking_1",
      amount: 8000,
      status: "SUCCEEDED",
      refundReference: "RF8F2A91C4D77B40AB",
    }],
  });
  const service = createService(repository);

  await assert.rejects(
    () => service.createRefund({
      paymentId: "pay_1",
      amount: 3000,
      reason: "booking_cancelled",
      refundBankName: "TPBank",
      refundAccountNumber: "123456",
      refundAccountName: "NGUYEN VAN A",
    }, "corr-8"),
    { code: "REFUND_AMOUNT_EXCEEDS_PAYMENT" }
  );
});

test("markRefundTransferred records staff transfer marker without changing status", async () => {
  const repository = new FakePaymentRepository({
    refunds: [{
      id: "refund_1",
      paymentId: "pay_1",
      bookingId: "booking_1",
      amount: 10000,
      status: "PENDING",
      refundReference: "RF8F2A91C4D77B40AB",
    }],
  });
  const service = createService(repository);

  const refund = await service.markRefundTransferred("refund_1", { sub: "staff_1", roles: ["staff"] });

  assert.equal(refund.status, "PENDING");
  assert.equal(refund.manualTransferMarkedBy, "staff_1");
});

test("manualCompleteRefund marks refund succeeded and publishes refund completed event", async () => {
  const repository = new FakePaymentRepository({
    payments: [{
      id: "pay_1",
      bookingId: "booking_1",
      amount: 10000,
      type: "booking",
      status: PAYMENT_STATES.COMPLETED,
      providerReference: "DHCMPTN4WMJ0000R00",
    }],
    refunds: [{
      id: "refund_1",
      paymentId: "pay_1",
      bookingId: "booking_1",
      amount: 10000,
      status: "PENDING",
      refundReference: "RF8F2A91C4D77B40AB",
    }],
  });
  const service = createService(repository);

  const refund = await service.manualCompleteRefund("refund_1", {
    providerTransactionId: "MANUAL-001",
    manualProofNote: "Bank receipt checked",
  }, { sub: "admin_1", roles: ["admin"] }, "corr-9");

  assert.equal(refund.status, "SUCCEEDED");
  assert.equal(refund.completedVia, "MANUAL_OVERRIDE");
  assert.equal(repository.payments.get("pay_1").status, PAYMENT_STATES.REFUNDED);
  assert.equal(repository.outbox.at(-1).event_type, "payment.refund_completed");
});

test("failRefund marks refund failed only for admin", async () => {
  const repository = new FakePaymentRepository({
    refunds: [{
      id: "refund_1",
      paymentId: "pay_1",
      bookingId: "booking_1",
      amount: 10000,
      status: "PENDING",
      refundReference: "RF8F2A91C4D77B40AB",
    }],
  });
  const service = createService(repository);

  await assert.rejects(
    () => service.failRefund("refund_1", { failureReason: "bad account" }, { sub: "staff_1", roles: ["staff"] }),
    { code: "FORBIDDEN" }
  );

  const refund = await service.failRefund("refund_1", { failureReason: "bad account" }, { sub: "admin_1", roles: ["admin"] });

  assert.equal(refund.status, "FAILED");
  assert.equal(refund.failureReason, "bad account");
});

test("retryRefund creates a new pending refund from a failed refund", async () => {
  const repository = new FakePaymentRepository({
    payments: [{
      id: "pay_1",
      bookingId: "booking_1",
      amount: 10000,
      type: "booking",
      status: PAYMENT_STATES.COMPLETED,
      providerReference: "DHCMPTN4WMJ0000R00",
    }],
    refunds: [{
      id: "refund_1",
      paymentId: "pay_1",
      bookingId: "booking_1",
      amount: 10000,
      status: "FAILED",
      reason: "booking_cancelled",
      refundReference: "RF8F2A91C4D77B40AB",
    }],
  });
  const service = createService(repository);

  const retry = await service.retryRefund("refund_1", {
    refundBankName: "TPBank",
    refundAccountNumber: "987654",
    refundAccountName: "NGUYEN VAN B",
  }, { sub: "admin_1", roles: ["admin"] }, "corr-10");

  assert.notEqual(retry.id, "refund_1");
  assert.equal(repository.refunds.get("refund_1").status, "FAILED");
  assert.equal(retry.status, "PENDING");
  assert.match(retry.refundReference, /^RF[0-9A-Z]{16}$/);
  assert.equal(retry.refundAccountNumber, "987654");
});
