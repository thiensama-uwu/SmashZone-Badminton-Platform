const crypto = require("crypto");

class SepayProvider {
  constructor(config) {
    this.config = config;
    this.bankCode = config.sepayBankCode || "";
    this.accountNumber = config.sepayAccountNumber || "";
    this.accountName = config.sepayAccountName || "";
    this.merchantId = config.sepayMerchantId || "";
    this.merchantSecret = config.sepayMerchantSecret || "";
    this.webhookSecret = config.sepayWebhookSecret || "";
  }

  get name() {
    return "sepay";
  }

  async createOrder(payment) {
    const transferContent = `DH${payment.id.replace(/-/g, "").slice(0, 16).toUpperCase()}`;
    const qrUrl = this._buildQrUrl(payment.amount, transferContent);

    return {
      providerReference: transferContent,
      providerStatus: "pending",
      qrDataUrl: qrUrl,
      checkoutUrl: null,
      transferContent,
      bankInfo: {
        bankCode: this.bankCode,
        accountNumber: this.accountNumber,
        accountName: this.accountName,
        amount: payment.amount,
        transferContent,
      },
    };
  }

  verifyWebhook(headers, body) {
    if (!this.webhookSecret) return true;

    const signature = headers["x-sepay-signature"] || headers["authorization"];
    if (!signature) return false;

    if (signature.startsWith("Bearer ")) {
      return signature.slice(7) === this.webhookSecret;
    }

    const expected = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(JSON.stringify(body))
      .digest("hex");
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  }

  normalizeCallback(body) {
    return this.normalizeIncomingPaymentCallback(body);
  }

  classifyCallback(body) {
    const content = this._callbackContent(body);
    const transferType = this._transferType(body);
    const transferAmount = this._transferAmount(body);
    const hasPaymentReference = /DH[0-9A-Z]{16}/.test(content);
    const hasRefundReference = /RF[0-9A-Z]{16}/.test(content);

    if (hasPaymentReference && hasRefundReference) {
      return { type: "ignored", reason: "AMBIGUOUS_REFERENCE" };
    }

    if (transferType === "in" && hasPaymentReference) {
      return { type: "incoming_payment", isLegacy: false };
    }

    if (transferType === "out" && hasRefundReference) {
      return { type: "outgoing_refund", isLegacy: false };
    }

    if (!transferType && hasPaymentReference && transferAmount > 0) {
      return { type: "incoming_payment", isLegacy: true };
    }

    if (!transferType && hasRefundReference) {
      return { type: "ignored", reason: "MISSING_TRANSFER_TYPE_FOR_REFUND" };
    }

    return { type: "ignored", reason: "UNSUPPORTED_CALLBACK" };
  }

  normalizeIncomingPaymentCallback(body) {
    const content = this._callbackContent(body);
    const transferAmount = this._transferAmount(body);
    const match = content.match(/DH[0-9A-Z]{16}/);

    return {
      paymentId: null,
      providerTransactionId: this._providerTransactionId(body),
      status: transferAmount > 0 ? "success" : "fail",
      transferContent: match ? match[0] : content,
      transferAmount,
      rawGateway: body.gateway || this.bankCode,
    };
  }

  normalizeOutgoingRefundCallback(body) {
    const content = this._callbackContent(body);
    const match = content.match(/RF[0-9A-Z]{16}/);

    return {
      providerTransactionId: this._providerTransactionId(body),
      refundReference: match ? match[0] : null,
      transferAmount: this._transferAmount(body),
      referenceCode: body.referenceCode || null,
      rawGateway: body.gateway || this.bankCode,
    };
  }

  _buildQrUrl(amount, content) {
    const params = new URLSearchParams({
      bank: this.bankCode,
      acc: this.accountNumber,
      amount: String(amount),
      des: content,
      template: "compact",
    });
    return `https://qr.sepay.vn/img?${params.toString()}`;
  }

  _callbackContent(body) {
    return (body.content || body.transferContent || body.description || "").toUpperCase();
  }

  _transferType(body) {
    return body.transferType ? String(body.transferType).toLowerCase() : null;
  }

  _transferAmount(body) {
    return Number(body.transferAmount || body.amount || 0);
  }

  _providerTransactionId(body) {
    return String(body.id || body.transactionId || body.referenceCode || `SEPAY-${Date.now()}`);
  }
}

module.exports = { SepayProvider };
