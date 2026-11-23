const { z } = require("zod");

const registerSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().min(9).max(15).optional(),
    password: z.string().min(8),
    fullName: z.string().min(2).max(120).optional(),
  })
  .refine((data) => data.email || data.phone, {
    message: "Email hoặc số điện thoại là bắt buộc",
    path: ["email"],
  });

const loginSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().min(9).max(15).optional(),
    password: z.string().min(1),
  })
  .refine((data) => data.email || data.phone, {
    message: "Email hoặc số điện thoại là bắt buộc",
    path: ["email"],
  });

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
  newPassword: z.string().min(8),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(8),
});

const googleAuthSchema = z.object({
  idToken: z.string().min(1),
});

module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  googleAuthSchema,
};
