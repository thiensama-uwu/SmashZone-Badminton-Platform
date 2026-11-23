const { z } = require("zod");

const createPaymentSchema = z.object({
  bookingId: z.string().min(1),
  totalAmount: z.number().int().positive().optional(),
  type: z.string().optional(),
  paymentScenario: z.object({
    providerStatus: z.enum(["success", "fail"]).default("success"),
    autoWebhook: z.boolean().default(false),
  }).optional(),
});

const webhookSchema = z.object({
  paymentId: z.string().min(1),
  status: z.enum(["success", "fail"]),
  providerTransactionId: z.string().min(1),
});

const refundSchema = z.object({
  amount: z.number().int().positive(),
  reason: z.string().optional(),
  refundBankName: z.string().min(1),
  refundAccountNumber: z.string().min(1),
  refundAccountName: z.string().min(1),
});

const manualCompleteRefundSchema = z.object({
  providerTransactionId: z.string().min(1).optional(),
  manualProofNote: z.string().min(1).optional(),
});

const failRefundSchema = z.object({
  failureReason: z.string().min(1),
});

const retryRefundSchema = z.object({
  refundBankName: z.string().min(1),
  refundAccountNumber: z.string().min(1),
  refundAccountName: z.string().min(1),
});

module.exports = {
  createPaymentSchema,
  webhookSchema,
  refundSchema,
  manualCompleteRefundSchema,
  failRefundSchema,
  retryRefundSchema,
};
