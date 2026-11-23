const { z } = require("zod");

const imageUrlSchema = z
  .string()
  .min(1)
  .refine(
    (value) => value.startsWith("/api/uploads/") || /^https?:\/\//.test(value) || /^data:image\//.test(value),
    { message: "Invalid image URL" }
  );

const listCourtsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional().default(""),
  includeInactive: z.coerce.boolean().optional().default(false),
  includeDeleted: z.coerce.boolean().optional().default(false),
});

const createCourtSchema = z.object({
  branchId: z.string().min(1).optional(),
  name: z.string().min(2),
  surface: z.string().min(1).optional(),
  description: z.string().optional(),
  imageUrl: imageUrlSchema.optional(),
  additionalImages: z.array(imageUrlSchema).max(5).optional(),
  defaultPrice: z.number().int().positive().optional(),
  slots: z.array(
    z.object({
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
    })
  ).optional(),
  address: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

const updateCourtSchema = z.object({
  branchId: z.string().min(1).optional(),
  name: z.string().min(2).optional(),
  surface: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  imageUrl: imageUrlSchema.optional().nullable(),
  additionalImages: z.array(imageUrlSchema).max(5).optional(),
  status: z.string().optional(),
  address: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
});

const availabilityQuerySchema = z.object({
  courtId: z.string().min(1),
  date: z.string().min(1),
});

const priceScheduleSchema = z.object({
  type: z.string().min(1),
  priority: z.number().int().positive(),
  price: z.number().int().positive(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  dates: z.array(z.string()).optional(),
});

const policySchema = z.object({
  refundBeforeHours: z.number().int().min(0).optional(),
  refundPercent: z.number().int().min(0).max(100).optional(),
  rescheduleBeforeHours: z.number().int().min(0).optional(),
});

const quoteSchema = z.object({
  courtId: z.string().min(1),
  date: z.string().min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

module.exports = {
  listCourtsQuerySchema,
  createCourtSchema,
  updateCourtSchema,
  availabilityQuerySchema,
  priceScheduleSchema,
  policySchema,
  quoteSchema,
};
