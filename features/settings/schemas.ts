import { type Infer, z } from "@/lib/validation/zod";

export const NAME_MAX = 255;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

// The current password is re-authentication: the API demands it whenever the email or the password change.
export function profileSchema(currentEmail: string) {
  return z
    .object({
      name: z
        .string()
        .trim()
        .min(1, { error: "validation.required" })
        .max(NAME_MAX, { error: "validation.nameMax" }),
      email: z.email({ error: "validation.email" }),
      newPassword: z.union([
        z.literal(""),
        z
          .string()
          .min(PASSWORD_MIN, { error: "validation.passwordMin" })
          .max(PASSWORD_MAX, { error: "validation.passwordMax" }),
      ]),
      currentPassword: z.string(),
    })
    .superRefine((values, context) => {
      const credentialsChange =
        values.newPassword.length > 0 ||
        values.email.trim().toLowerCase() !== currentEmail.trim().toLowerCase();
      if (credentialsChange && !values.currentPassword)
        context.addIssue({
          code: "custom",
          path: ["currentPassword"],
          message: "validation.required",
        });
    });
}

export type ProfileValues = Infer<ReturnType<typeof profileSchema>>;

export function deleteConfirmationSchema(word: string) {
  return z.object({
    confirmation: z.string().refine((value) => value.trim() === word, {
      error: "validation.confirmWord",
    }),
  });
}
