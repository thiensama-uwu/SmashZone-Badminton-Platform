const assert = require("node:assert/strict");
const test = require("node:test");
const { refundSchema } = require("./payment-schemas");

test("refund schema requires refund recipient bank fields", () => {
  const parsed = refundSchema.parse({
    amount: 10000,
    reason: "booking_cancelled",
    refundBankName: "TPBank",
    refundAccountNumber: "123456789",
    refundAccountName: "NGUYEN VAN A",
  });

  assert.equal(parsed.refundBankName, "TPBank");
  assert.equal(parsed.refundAccountNumber, "123456789");
  assert.equal(parsed.refundAccountName, "NGUYEN VAN A");
});
