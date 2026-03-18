export type BudgetColor =
  | "amber-200"
  | "amber-400"
  | "teal-400"
  | "red-400"
  | "blue-400"
  | "purple-400"
  | "stone-400";

export const BUDGET_COLOR_CLASSES: Record<BudgetColor, string> = {
  "amber-200": "bg-amber-200",
  "amber-400": "bg-amber-400",
  "teal-400": "bg-teal-400",
  "red-400": "bg-red-400",
  "blue-400": "bg-blue-400",
  "purple-400": "bg-purple-400",
  "stone-400": "bg-stone-400",
};

export type Budget = {
  id: string;
  name: string;
  emoji: string;
  color: BudgetColor;
  amount: number;
  spent: number;
};
