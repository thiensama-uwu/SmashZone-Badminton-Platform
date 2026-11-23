const { z } = require("zod");

const bootstrapProfileSchema = z.object({
  userId: z.string().min(1),
  email: z.string().email(),
  fullName: z.string().min(2).max(120),
  phone: z.string().max(20).optional().nullable(),
  gender: z.string().max(20).optional().nullable(),
  birthDate: z.string().optional().nullable(),
});

const updateProfileSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  phone: z.string().max(20).optional().nullable(),
  gender: z.string().max(20).optional().nullable(),
  birthDate: z.string().optional().nullable(),
  avatarUrl: z.string().max(500).optional().nullable(),
  version: z.number().int().positive().optional(),
});

const adminUpdateUserSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional(),
  roles: z.array(z.string()).optional(),
  fullName: z.string().min(2).max(120).optional(),
  phone: z.string().max(20).optional().nullable(),
  gender: z.string().max(20).optional().nullable(),
  birthDate: z.string().optional().nullable(),
});

const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20).optional(),
  status: z.string().optional(),
  search: z.string().optional(),
});

const adminCreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
  roles: z.array(z.string()).min(1),
  fullName: z.string().min(2).max(120),
  phone: z.string().max(20).optional().nullable(),
  gender: z.string().max(20).optional().nullable(),
  birthDate: z.string().optional().nullable(),
});

module.exports = {
  bootstrapProfileSchema,
  updateProfileSchema,
  adminUpdateUserSchema,
  adminCreateUserSchema,
  listUsersQuerySchema,
};
