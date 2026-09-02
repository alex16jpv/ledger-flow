import { z } from "zod";

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
export const NAME_MAX = 255;

export const loginSchema = z.object({
  email: z.email({ error: "validation.email" }),
  password: z.string().min(1, { error: "validation.required" }),
});

export type LoginValues = z.infer<typeof loginSchema>;
