import { z } from "zod";

export const CATEGORY_EMOJI_OPTIONS = [
  { emoji: "🍔", label: "Food" },
  { emoji: "🚌", label: "Transport" },
  { emoji: "🏠", label: "Home" },
  { emoji: "🎬", label: "Entertainment" },
  { emoji: "💊", label: "Health" },
  { emoji: "🛒", label: "Shopping" },
  { emoji: "✈️", label: "Travel" },
  { emoji: "💼", label: "Work" },
  { emoji: "📚", label: "Education" },
  { emoji: "💰", label: "Savings" },
  { emoji: "📦", label: "Other" },
  { emoji: "☕", label: "Coffee" },
  { emoji: "💻", label: "Tech" },
  { emoji: "🎮", label: "Gaming" },
  { emoji: "👕", label: "Clothing" },
  { emoji: "🏋️", label: "Fitness" },
] as const;

export type CategoryEmoji = (typeof CATEGORY_EMOJI_OPTIONS)[number]["emoji"];

const VALID_EMOJIS = CATEGORY_EMOJI_OPTIONS.map((o) => o.emoji) as unknown as [
  string,
  ...string[],
];

export const createCategorySchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(255, "Name must be 255 characters or less"),
  emoji: z.enum(VALID_EMOJIS, { message: "Please select an icon" }).optional(),
});

export type CreateCategoryFormFields = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z.object({
  name: z
    .string()
    .min(1, "Name must not be empty")
    .max(255, "Name must be 255 characters or less")
    .optional(),
  emoji: z.enum(VALID_EMOJIS, { message: "Please select an icon" }).optional(),
});

export type UpdateCategoryFormFields = z.infer<typeof updateCategorySchema>;
