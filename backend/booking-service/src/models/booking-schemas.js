const { z } = require("zod");

const slotSegmentSchema = z.object({
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

const holdSchema = z
  .object({
    courtId: z.string().min(1),
    date: z.string().min(1),
    segments: z.array(slotSegmentSchema).min(1).max(32),
    startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    origin: z.string().optional(),
    paymentScenario: z.object({
      providerStatus: z.enum(["success", "fail"]).default("success"),
      autoWebhook: z.boolean().default(false),
    }).optional(),
  });

const createBookingSchema = z.object({
  bookingId: z.string().min(1),
});

const refundRecipientFields = {
  refundBankName: z.string().min(1).optional(),
  refundAccountNumber: z.string().min(1).optional(),
  refundAccountName: z.string().min(1).optional(),
};

const cancelBookingSchema = z.object({
  cancelReason: z.string().optional(),
  ...refundRecipientFields,
});

const rescheduleSchema = z.object({
  courtId: z.string().min(1),
  date: z.string().min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  ...refundRecipientFields,
  paymentScenario: z.object({
    providerStatus: z.enum(["success", "fail"]).default("success"),
    autoWebhook: z.boolean().default(false),
  }).optional(),
});

const staffCreateSchema = z.object({
  courtId: z.string().min(1),
  date: z.string().min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  userId: z.string().optional(),
  selectedSlots: z.array(z.string().regex(/^\d{2}:\d{2}$/)).max(2).optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional().nullable(),
  billStatus: z.enum(["pending", "paid"]).optional(),
  paymentScenario: z.object({
    providerStatus: z.enum(["success", "fail"]).default("success"),
    autoWebhook: z.boolean().default(false),
  }).optional(),
});

const reservationQuerySchema = z.object({
  courtId: z.string().min(1),
  date: z.string().min(1),
});

module.exports = {
  holdSchema,
  createBookingSchema,
  cancelBookingSchema,
  rescheduleSchema,
  staffCreateSchema,
  reservationQuerySchema,
};
