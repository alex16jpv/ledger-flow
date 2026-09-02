import { z } from "zod";

import { CATEGORY_ICON_KEYS } from "@/lib/icons/category-icons";
import { COLOR_TOKENS } from "@/lib/theme/feature-color";
import type { components } from "@/types/api";

export const CATEGORY_TYPES = [
  "EXPENSE",
  "INCOME",
  "TRANSFER",
] as const satisfies readonly NonNullable<components["schemas"]["CreateCategoryInput"]["type"]>[];

export const CATEGORY_NAME_MAX = 255;

export const categoryFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "validation.required" })
    .max(CATEGORY_NAME_MAX, { error: "validation.nameMax" }),
  icon: z.enum(CATEGORY_ICON_KEYS, { error: "validation.required" }),
  color: z.enum(COLOR_TOKENS, { error: "validation.required" }),
  type: z.enum(CATEGORY_TYPES, { error: "validation.required" }),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;
