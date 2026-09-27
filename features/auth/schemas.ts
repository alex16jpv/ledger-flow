import { type Infer, z } from "@/lib/validation/zod";

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
export const NAME_MAX = 255;

export const loginSchema = z.object({
  email: z.email({ error: "validation.email" }),
  password: z.string().min(1, { error: "validation.required" }),
});

export type LoginValues = Infer<typeof loginSchema>;

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "validation.required" })
    .max(NAME_MAX, { error: "validation.nameMax" }),
  email: z.email({ error: "validation.email" }),
  password: z
    .string()
    .min(PASSWORD_MIN, { error: "validation.passwordMin" })
    .max(PASSWORD_MAX, { error: "validation.passwordMax" }),
  currency: z.string().length(3, { error: "validation.currency" }),
  timezone: z.string().min(1, { error: "validation.timeZone" }),
  consent: z.boolean().refine((value) => value, { error: "validation.consent" }),
});

export type RegisterValues = Infer<typeof registerSchema>;

const newPassword = z
  .string()
  .min(PASSWORD_MIN, { error: "validation.passwordRange" })
  .max(PASSWORD_MAX, { error: "validation.passwordRange" });

export const forgotSchema = z.object({
  email: z.email({ error: "validation.email" }),
});

export type ForgotValues = Infer<typeof forgotSchema>;

export const resetCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, { error: "validation.code" }),
  newPassword,
});

export type ResetCodeValues = Infer<typeof resetCodeSchema>;

export const resetLinkSchema = z.object({ newPassword });

export type ResetLinkValues = Infer<typeof resetLinkSchema>;

export const freshDetailsSchema = z.object({
  name: registerSchema.shape.name,
  currency: registerSchema.shape.currency,
  timezone: registerSchema.shape.timezone,
});

export type FreshDetailsValues = Infer<typeof freshDetailsSchema>;
