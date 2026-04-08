import { z } from "zod";
import { BudgetColor } from "@/types/Budget.types";

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
  color: z.enum(BUDGET_COLORS, { message: "Color is required" }),
  categoryId: z.string().min(1, "Category is required"),
  amount: z
    .number({ message: "Amount is required" })
    .positive("Amount must be greater than 0"),
  note: z.string().optional(),
});

export type BudgetFormFields = z.infer<typeof budgetSchema>;
