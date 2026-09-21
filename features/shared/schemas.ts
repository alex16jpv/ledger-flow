import { COLOR_TOKENS } from "@/lib/theme/feature-color";
import { type Infer, z } from "@/lib/validation/zod";

export const CONTACT_NAME_MAX = 255;

export const contactFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "validation.required" })
    .max(CONTACT_NAME_MAX, { error: "validation.nameMax" }),
  color: z.enum(COLOR_TOKENS, { error: "validation.required" }),
  // An identifier for inviting them later, never an address anything is sent to.
  email: z.union([z.literal(""), z.email({ error: "validation.email" })]),
});

export type ContactFormValues = Infer<typeof contactFormSchema>;
