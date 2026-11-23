class MockProvider {
  constructor(config) {
    this.config = config;
  }

  get name() {
    return "mock";
  }

  async createOrder(payment) {
    return {
      providerReference: `MOCK-${Date.now()}`,
      providerStatus: payment.providerStatus || "success",
      qrDataUrl: null,
      checkoutUrl: null,
    };
  }

  verifyWebhook(headers, body) {
    const signature = headers["x-mock-signature"];
    const expected = this.config.signWebhook(
      `${body.paymentId}:${body.status}:${body.providerTransactionId}`
    );
    return signature === expected;
  }

  normalizeCallback(body) {
    return {
      paymentId: body.paymentId,
      providerTransactionId: body.providerTransactionId,
      status: body.status === "success" ? "success" : "fail",
    };
  }
}

module.exports = { MockProvider };
