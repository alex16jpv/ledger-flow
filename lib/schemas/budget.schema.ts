import { z } from "zod";
import { BudgetColor } from "@/types/Budget.type";
import { CATEGORY_NAMES } from "@/utils/constants";

const BUDGET_COLORS: [BudgetColor, ...BudgetColor[]] = [
  "teal-400",
  "blue-400",
  "purple-400",
  "amber-400",
  "amber-200",
  "red-400",
  "stone-400",
];

export const budgetSchema = z.object({
  name: z.string().min(1, "Name is required"),
  emoji: z.string().min(1, "Emoji is required"),
  color: z.enum(BUDGET_COLORS, { message: "Color is required" }),
  category: z.enum(CATEGORY_NAMES, { message: "Category is required" }),
  amount: z
    .number({ message: "Amount is required" })
    .positive("Amount must be greater than 0"),
  note: z.string().optional(),
});

export type BudgetFormFields = z.infer<typeof budgetSchema>;
