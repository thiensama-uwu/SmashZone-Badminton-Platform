const assert = require("node:assert/strict");
const test = require("node:test");
const { cancelBookingSchema, rescheduleSchema } = require("./booking-schemas");

test("cancel booking schema accepts refund recipient bank fields", () => {
  const parsed = cancelBookingSchema.parse({
    cancelReason: "customer_request",
    refundBankName: "TPBank",
    refundAccountNumber: "123456789",
    refundAccountName: "NGUYEN VAN A",
  });

  assert.equal(parsed.refundBankName, "TPBank");
  assert.equal(parsed.refundAccountNumber, "123456789");
  assert.equal(parsed.refundAccountName, "NGUYEN VAN A");
});

test("reschedule schema accepts refund recipient bank fields for negative delta refunds", () => {
  const parsed = rescheduleSchema.parse({
    courtId: "court_1",
    date: "2026-06-05",
    startTime: "18:00",
    endTime: "19:00",
    refundBankName: "TPBank",
    refundAccountNumber: "123456789",
    refundAccountName: "NGUYEN VAN A",
  });

  assert.equal(parsed.refundBankName, "TPBank");
  assert.equal(parsed.refundAccountNumber, "123456789");
  assert.equal(parsed.refundAccountName, "NGUYEN VAN A");
});
