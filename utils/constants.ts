import { BudgetColor } from "@/types/Budget.type";

export const TRANSACTION_TYPES = {
  EXPENSE: "EXPENSE",
  INCOME: "INCOME",
  TRANSFER: "TRANSFER",
} as const;

export type TransactionKind =
  (typeof TRANSACTION_TYPES)[keyof typeof TRANSACTION_TYPES];

export const ACCOUNT_TYPES = {
  DEBIT: "DEBIT",
  SAVINGS: "SAVINGS",
  CREDIT: "CREDIT",
  DIGITAL_WALLET: "DIGITAL_WALLET",
  INVESTMENT: "INVESTMENT",
  CASH: "CASH",
} as const;

export type AccountKind = (typeof ACCOUNT_TYPES)[keyof typeof ACCOUNT_TYPES];

export const ACCOUNT_TYPE_LABELS: Record<AccountKind, string> = {
  DEBIT: "Debit",
  SAVINGS: "Savings",
  CREDIT: "Credit",
  DIGITAL_WALLET: "Digital Wallet",
  INVESTMENT: "Investment",
  CASH: "Cash",
};

type AccountTypeColors = {
  bgColor: string;
  borderColor: string;
  textColor: string;
  accentColor: string;
  sparkLight: string;
  sparkDark: string;
};

export const ACCOUNT_TYPE_COLORS: Record<AccountKind, AccountTypeColors> = {
  DEBIT: {
    bgColor: "bg-teal-50",
    borderColor: "border-teal-100",
    textColor: "text-teal-800",
    accentColor: "text-teal-600",
    sparkLight: "bg-teal-100",
    sparkDark: "bg-teal-400",
  },
  SAVINGS: {
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    textColor: "text-purple-800",
    accentColor: "text-purple-600",
    sparkLight: "bg-purple-200",
    sparkDark: "bg-purple-400",
  },
  CREDIT: {
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    textColor: "text-amber-600",
    accentColor: "text-amber-600",
    sparkLight: "bg-amber-200",
    sparkDark: "bg-amber-400",
  },
  DIGITAL_WALLET: {
    bgColor: "bg-blue-50",
    borderColor: "border-blue-100",
    textColor: "text-blue-600",
    accentColor: "text-blue-600",
    sparkLight: "bg-blue-100",
    sparkDark: "bg-blue-400",
  },
  INVESTMENT: {
    bgColor: "bg-teal-50",
    borderColor: "border-teal-100",
    textColor: "text-teal-800",
    accentColor: "text-teal-600",
    sparkLight: "bg-teal-100",
    sparkDark: "bg-teal-400",
  },
  CASH: {
    bgColor: "bg-stone-50",
    borderColor: "border-stone-100",
    textColor: "text-stone-800",
    accentColor: "text-stone-600",
    sparkLight: "bg-stone-100",
    sparkDark: "bg-stone-400",
  },
};

export const TRANSACTION_TYPE_LABELS = {
  EXPENSE: "Expense",
  INCOME: "Income",
  TRANSFER: "Transfer",
} as const;

type TypeColors = {
  bgColor: string;
  textColor: string;
  borderColor: string;
  btnBgColor: string;
  btnHoverBgColor: string;
  selectedClass: string;
};

export type CategoryStyle = {
  bgColor: string;
  textColor: string;
  dotColor: string;
};

export const CATEGORY_NAMES = [
  "Food",
  "Transport",
  "Entertainment",
  "Home",
  "Health",
  "Salary",
  "Freelance",
  "Shopping",
  "Savings",
  "Investment",
] as const;

export type Category = (typeof CATEGORY_NAMES)[number];

export const CATEGORY_STYLES: Record<Category, CategoryStyle> = {
  Food: {
    bgColor: "bg-teal-50",
    textColor: "text-teal-800",
    dotColor: "bg-amber-400",
  },
  Transport: {
    bgColor: "bg-blue-50",
    textColor: "text-blue-600",
    dotColor: "bg-blue-400",
  },
  Entertainment: {
    bgColor: "bg-amber-50",
    textColor: "text-amber-600",
    dotColor: "bg-purple-400",
  },
  Home: {
    bgColor: "bg-stone-100",
    textColor: "text-stone-600",
    dotColor: "bg-stone-400",
  },
  Health: {
    bgColor: "bg-teal-50",
    textColor: "text-teal-800",
    dotColor: "bg-teal-400",
  },
  Salary: {
    bgColor: "bg-teal-50",
    textColor: "text-teal-800",
    dotColor: "bg-teal-400",
  },
  Freelance: {
    bgColor: "bg-teal-50",
    textColor: "text-teal-800",
    dotColor: "bg-teal-400",
  },
  Shopping: {
    bgColor: "bg-purple-50",
    textColor: "text-purple-600",
    dotColor: "bg-purple-400",
  },
  Savings: {
    bgColor: "bg-blue-50",
    textColor: "text-blue-600",
    dotColor: "bg-blue-400",
  },
  Investment: {
    bgColor: "bg-blue-50",
    textColor: "text-blue-600",
    dotColor: "bg-blue-400",
  },
};

export const DEFAULT_CATEGORY_STYLE: CategoryStyle = {
  bgColor: "bg-stone-50",
  textColor: "text-stone-600",
  dotColor: "bg-stone-400",
};

export const TRANSACTION_TYPE_COLORS: Record<TransactionKind, TypeColors> = {
  EXPENSE: {
    bgColor: "bg-red-50",
    textColor: "text-red-600",
    borderColor: "border-red-100",
    btnBgColor: "bg-red-400",
    btnHoverBgColor: "hover:bg-red-600",
    selectedClass: "bg-red-50 text-red-600 border-red-400",
  },
  INCOME: {
    bgColor: "bg-teal-50",
    textColor: "text-teal-600",
    borderColor: "border-teal-100",
    btnBgColor: "bg-teal-400",
    btnHoverBgColor: "hover:bg-teal-600",
    selectedClass: "bg-teal-50 text-teal-600 border-teal-400",
  },
  TRANSFER: {
    bgColor: "bg-blue-50",
    textColor: "text-blue-600",
    borderColor: "border-blue-100",
    btnBgColor: "bg-blue-400",
    btnHoverBgColor: "hover:bg-blue-600",
    selectedClass: "bg-blue-50 text-blue-600 border-blue-400",
  },
};

export const BUDGET_COLOR_CLASSES: Record<BudgetColor, string> = {
  "amber-200": "bg-amber-200",
  "amber-400": "bg-amber-400",
  "teal-400": "bg-teal-400",
  "red-400": "bg-red-400",
  "blue-400": "bg-blue-400",
  "purple-400": "bg-purple-400",
  "stone-400": "bg-stone-400",
};
