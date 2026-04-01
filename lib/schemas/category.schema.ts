import { z } from "zod";
import { CATEGORY_COLORS, TRANSACTION_TYPES } from "@/utils/constants";

const VALID_COLORS = Object.values(CATEGORY_COLORS) as [string, ...string[]];
const VALID_TYPES = Object.values(TRANSACTION_TYPES) as [string, ...string[]];

export const createCategorySchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(255, "Name must be 255 characters or less"),
  emoji: z.string().min(1, "Please select an icon").optional(),
  color: z.enum(VALID_COLORS, { message: "Please select a color" }).optional(),
  type: z.enum(VALID_TYPES, { message: "Please select a type" }),
});

export type CreateCategoryFormFields = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z.object({
  name: z
    .string()
    .min(1, "Name must not be empty")
    .max(255, "Name must be 255 characters or less")
    .optional(),
  emoji: z.string().min(1, "Please select an icon").optional(),
  color: z.enum(VALID_COLORS, { message: "Please select a color" }).optional(),
  type: z.enum(VALID_TYPES, { message: "Please select a type" }).optional(),
});

export type UpdateCategoryFormFields = z.infer<typeof updateCategorySchema>;
