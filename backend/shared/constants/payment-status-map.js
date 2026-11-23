const { BOOKING_STATES, PAYMENT_STATES } = require("./booking");

/**
 * Formal mapping: payment status → expected booking status transition.
 * Each entry defines what booking status should result from a payment event.
 */
const PAYMENT_TO_BOOKING_MAP = {
  [PAYMENT_STATES.COMPLETED]: {
    booking: {
      from: [BOOKING_STATES.PENDING_PAYMENT],
      to: BOOKING_STATES.CONFIRMED,
    },
    reschedule: {
      from: [BOOKING_STATES.CONFIRMED],
      to: BOOKING_STATES.CONFIRMED,
    },
  },
  [PAYMENT_STATES.FAILED]: {
    booking: {
      from: [BOOKING_STATES.PENDING_PAYMENT],
      to: BOOKING_STATES.CANCELLED,
      reason: "PAYMENT_FAILED",
    },
    reschedule: {
      from: [BOOKING_STATES.CONFIRMED],
      to: BOOKING_STATES.CONFIRMED,
      action: "ROLLBACK_RESCHEDULE",
    },
  },
  [PAYMENT_STATES.REFUNDED]: {
    booking: {
      from: [BOOKING_STATES.REFUND_PENDING],
      to: BOOKING_STATES.REFUNDED,
    },
  },
};

const TIMEOUT_POLICY = {
  paymentTimeoutMs: 120_000,
  sweepIntervalMs: 120_000,
  paymentOnTimeout: PAYMENT_STATES.FAILED,
  bookingOnPaymentTimeout: BOOKING_STATES.CANCELLED,
  bookingTimeoutReason: "PAYMENT_TIMEOUT",
};

function resolveBookingTransition(paymentStatus, paymentType) {
  const mapping = PAYMENT_TO_BOOKING_MAP[paymentStatus];
  if (!mapping) return null;
  return mapping[paymentType] || mapping["booking"] || null;
}

module.exports = {
  PAYMENT_TO_BOOKING_MAP,
  TIMEOUT_POLICY,
  resolveBookingTransition,
};
