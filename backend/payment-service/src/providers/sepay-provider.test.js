const assert = require("node:assert/strict");
const test = require("node:test");
const { SepayProvider } = require("./sepay-provider");

function createProvider() {
  return new SepayProvider({
    sepayBankCode: "TESTBANK",
    sepayAccountNumber: "1234567890",
    sepayAccountName: "COURT BOOKING",
  });
}

const realIncomingPayload = {
  id: 61258838,
  code: null,
  content: "DHCMPTN4WMJ0000R00 FT26152780062026",
  gateway: "TESTBANK",
  subAccount: null,
  accumulated: 38000,
  description: "BankAPINotify DHCMPTN4WMJ0000R00 FT26152780062026",
  transferType: "in",
  accountNumber: "1234567890",
  referenceCode: "668V602261525474",
  transferAmount: 10000,
  transactionDate: "2026-05-31 17:33:10",
};

test("classifies SePay transferType=in with DH reference as incoming payment", () => {
  const provider = createProvider();

  const classification = provider.classifyCallback(realIncomingPayload);
  const normalized = provider.normalizeIncomingPaymentCallback(realIncomingPayload);

  assert.equal(classification.type, "incoming_payment");
  assert.equal(classification.isLegacy, false);
  assert.equal(normalized.transferContent, "DHCMPTN4WMJ0000R00");
  assert.equal(normalized.providerTransactionId, "61258838");
  assert.equal(normalized.status, "success");
  assert.equal(normalized.transferAmount, 10000);
});

test("classifies SePay transferType=out with RF reference as outgoing refund", () => {
  const provider = createProvider();
  const payload = {
    id: 70000001,
    content: "RF8F2A91C4D77B40AB HOAN TIEN",
    description: "BankAPINotify RF8F2A91C4D77B40AB HOAN TIEN",
    transferType: "out",
    transferAmount: 10000,
    referenceCode: "OUT-001",
    gateway: "TESTBANK",
  };

  const classification = provider.classifyCallback(payload);
  const normalized = provider.normalizeOutgoingRefundCallback(payload);

  assert.equal(classification.type, "outgoing_refund");
  assert.equal(normalized.refundReference, "RF8F2A91C4D77B40AB");
  assert.equal(normalized.providerTransactionId, "70000001");
  assert.equal(normalized.transferAmount, 10000);
});

test("supports legacy incoming payment when transferType is missing but DH reference matches", () => {
  const provider = createProvider();
  const legacyPayload = { ...realIncomingPayload };
  delete legacyPayload.transferType;

  const classification = provider.classifyCallback(legacyPayload);

  assert.equal(classification.type, "incoming_payment");
  assert.equal(classification.isLegacy, true);
});

test("ignores missing transferType with RF reference instead of guessing refund", () => {
  const provider = createProvider();
  const payload = {
    id: 70000002,
    content: "RF8F2A91C4D77B40AB HOAN TIEN",
    transferAmount: 10000,
  };

  const classification = provider.classifyCallback(payload);

  assert.equal(classification.type, "ignored");
  assert.equal(classification.reason, "MISSING_TRANSFER_TYPE_FOR_REFUND");
});

test("ignores ambiguous SePay content containing both DH and RF references", () => {
  const provider = createProvider();
  const payload = {
    id: 70000003,
    content: "DHCMPTN4WMJ0000R00 RF8F2A91C4D77B40AB",
    transferType: "in",
    transferAmount: 10000,
  };

  const classification = provider.classifyCallback(payload);

  assert.equal(classification.type, "ignored");
  assert.equal(classification.reason, "AMBIGUOUS_REFERENCE");
});
