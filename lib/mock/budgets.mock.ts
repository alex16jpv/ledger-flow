import { Budget } from "@/types/Budget.type";

export const MOCK_BUDGETS: Budget[] = [
  {
    id: "1",
    name: "Food",
    emoji: "🍔",
    color: "amber-200",
    category: "Food",
    amount: 5000,
    spent: 4200,
  },
  {
    id: "2",
    name: "Transportation",
    emoji: "🚌",
    color: "teal-400",
    category: "Transport",
    amount: 3000,
    spent: 1100,
  },
  {
    id: "3",
    name: "Entertainment",
    emoji: "🎬",
    color: "red-400",
    category: "Entertainment",
    amount: 2000,
    spent: 2400,
  },
  {
    id: "4",
    name: "Home",
    emoji: "🏠",
    color: "amber-400",
    category: "Home",
    amount: 30000,
    spent: 28000,
  },
  {
    id: "5",
    name: "Health",
    emoji: "💊",
    color: "teal-400",
    category: "Health",
    amount: 2000,
    spent: 680,
  },
];
