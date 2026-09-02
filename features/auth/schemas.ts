import { z } from "zod";

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
export const NAME_MAX = 255;

export const loginSchema = z.object({
  email: z.email({ error: "validation.email" }),
  password: z.string().min(1, { error: "validation.required" }),
});

export type LoginValues = z.infer<typeof loginSchema>;

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

export type RegisterValues = z.infer<typeof registerSchema>;
