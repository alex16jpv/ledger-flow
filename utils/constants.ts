import { BudgetColor } from "@/types/Budget.type";

export const TRANSACTION_TYPES = {
  EXPENSE: "EXPENSE",
  INCOME: "INCOME",
  TRANSFER: "TRANSFER",
} as const;

export type TransactionKind =
  (typeof TRANSACTION_TYPES)[keyof typeof TRANSACTION_TYPES];

export const ACCOUNT_TYPES = {
  CASH: "CASH",
  ACCOUNT: "ACCOUNT",
  CARD: "CARD",
  DEBIT_CARD: "DEBIT_CARD",
  SAVINGS: "SAVINGS",
  INVESTMENT: "INVESTMENT",
  OVERDRAFT: "OVERDRAFT",
  LOAN: "LOAN",
  OTHER: "OTHER",
} as const;

export type AccountKind = (typeof ACCOUNT_TYPES)[keyof typeof ACCOUNT_TYPES];

export const ACCOUNT_TYPE_LABELS: Record<AccountKind, string> = {
  CASH: "Cash",
  ACCOUNT: "Account",
  CARD: "Card",
  DEBIT_CARD: "Debit Card",
  SAVINGS: "Savings",
  INVESTMENT: "Investment",
  OVERDRAFT: "Overdraft",
  LOAN: "Loan",
  OTHER: "Other",
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
  CASH: {
    bgColor: "bg-stone-50",
    borderColor: "border-stone-100",
    textColor: "text-stone-800",
    accentColor: "text-stone-600",
    sparkLight: "bg-stone-100",
    sparkDark: "bg-stone-400",
  },
  ACCOUNT: {
    bgColor: "bg-teal-50",
    borderColor: "border-teal-100",
    textColor: "text-teal-800",
    accentColor: "text-teal-600",
    sparkLight: "bg-teal-100",
    sparkDark: "bg-teal-400",
  },
  CARD: {
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    textColor: "text-amber-600",
    accentColor: "text-amber-600",
    sparkLight: "bg-amber-200",
    sparkDark: "bg-amber-400",
  },
  DEBIT_CARD: {
    bgColor: "bg-teal-50",
    borderColor: "border-teal-200",
    textColor: "text-teal-800",
    accentColor: "text-teal-600",
    sparkLight: "bg-teal-200",
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
  INVESTMENT: {
    bgColor: "bg-blue-50",
    borderColor: "border-blue-100",
    textColor: "text-blue-800",
    accentColor: "text-blue-600",
    sparkLight: "bg-blue-100",
    sparkDark: "bg-blue-400",
  },
  OVERDRAFT: {
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    textColor: "text-red-800",
    accentColor: "text-red-600",
    sparkLight: "bg-red-100",
    sparkDark: "bg-red-400",
  },
  LOAN: {
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    textColor: "text-orange-800",
    accentColor: "text-orange-600",
    sparkLight: "bg-orange-100",
    sparkDark: "bg-orange-400",
  },
  OTHER: {
    bgColor: "bg-stone-50",
    borderColor: "border-stone-200",
    textColor: "text-stone-700",
    accentColor: "text-stone-500",
    sparkLight: "bg-stone-200",
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

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

export const BUDGET_WARNING_THRESHOLD_PERCENT = 80;

export const DEFAULT_LIST_LIMIT = "100";
export const RECENT_ITEMS_LIMIT = "5";

export const APP_LOCALE = "en-US";
export const APP_CURRENCY = "USD";
export const APP_CURRENCY_SYMBOL = "$";

export const DEFAULT_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days
