export type BudgetColor =
  | "amber-200"
  | "amber-400"
  | "teal-400"
  | "red-400"
  | "blue-400"
  | "purple-400"
  | "stone-400";

export type Budget = {
  id: string;
  name: string;
  emoji: string;
  color: BudgetColor;
  category: string;
  amount: number;
  spent: number;
};
