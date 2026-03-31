import { Budget } from "@/types/Budget.type";

export const MOCK_BUDGETS: Budget[] = [
  {
    id: "1",
    name: "Food",
    color: "amber-200",
    categoryId: "cat_1",
    amount: 5000,
    spent: 4200,
  },
  {
    id: "2",
    name: "Transportation",
    color: "teal-400",
    categoryId: "cat_2",
    amount: 3000,
    spent: 1100,
  },
  {
    id: "3",
    name: "Entertainment",
    color: "red-400",
    categoryId: "cat_4",
    amount: 2000,
    spent: 2400,
  },
  {
    id: "4",
    name: "Home",
    color: "amber-400",
    categoryId: "cat_3",
    amount: 30000,
    spent: 28000,
  },
  {
    id: "5",
    name: "Health",
    color: "teal-400",
    categoryId: "cat_5",
    amount: 2000,
    spent: 680,
  },
];
