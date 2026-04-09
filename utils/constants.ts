import { BudgetColor } from "@/types/Budget.types";

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

export const CATEGORY_COLORS = {
  RED: "RED",
  ORANGE: "ORANGE",
  AMBER: "AMBER",
  YELLOW: "YELLOW",
  LIME: "LIME",
  GREEN: "GREEN",
  TEAL: "TEAL",
  CYAN: "CYAN",
  BLUE: "BLUE",
  INDIGO: "INDIGO",
  PURPLE: "PURPLE",
  PINK: "PINK",
  ROSE: "ROSE",
  GRAY: "GRAY",
  BROWN: "BROWN",
  BLACK: "BLACK",
} as const;

export type CategoryColor =
  (typeof CATEGORY_COLORS)[keyof typeof CATEGORY_COLORS];

type CategoryColorStyle = {
  bg: string;
  border: string;
  ring: string;
  dot: string;
};

export const CATEGORY_COLOR_STYLES: Record<CategoryColor, CategoryColorStyle> =
  {
    RED: {
      bg: "bg-red-50",
      border: "border-red-400",
      ring: "ring-red-400/30",
      dot: "bg-red-400",
    },
    ORANGE: {
      bg: "bg-orange-50",
      border: "border-orange-400",
      ring: "ring-orange-400/30",
      dot: "bg-orange-400",
    },
    AMBER: {
      bg: "bg-amber-50",
      border: "border-amber-400",
      ring: "ring-amber-400/30",
      dot: "bg-amber-400",
    },
    YELLOW: {
      bg: "bg-yellow-50",
      border: "border-yellow-400",
      ring: "ring-yellow-400/30",
      dot: "bg-yellow-400",
    },
    LIME: {
      bg: "bg-lime-50",
      border: "border-lime-500",
      ring: "ring-lime-500/30",
      dot: "bg-lime-500",
    },
    GREEN: {
      bg: "bg-green-50",
      border: "border-green-500",
      ring: "ring-green-500/30",
      dot: "bg-green-500",
    },
    TEAL: {
      bg: "bg-teal-50",
      border: "border-teal-400",
      ring: "ring-teal-400/30",
      dot: "bg-teal-400",
    },
    CYAN: {
      bg: "bg-cyan-50",
      border: "border-cyan-500",
      ring: "ring-cyan-500/30",
      dot: "bg-cyan-500",
    },
    BLUE: {
      bg: "bg-blue-50",
      border: "border-blue-400",
      ring: "ring-blue-400/30",
      dot: "bg-blue-400",
    },
    INDIGO: {
      bg: "bg-indigo-50",
      border: "border-indigo-400",
      ring: "ring-indigo-400/30",
      dot: "bg-indigo-400",
    },
    PURPLE: {
      bg: "bg-purple-50",
      border: "border-purple-400",
      ring: "ring-purple-400/30",
      dot: "bg-purple-400",
    },
    PINK: {
      bg: "bg-pink-50",
      border: "border-pink-400",
      ring: "ring-pink-400/30",
      dot: "bg-pink-400",
    },
    ROSE: {
      bg: "bg-rose-50",
      border: "border-rose-400",
      ring: "ring-rose-400/30",
      dot: "bg-rose-400",
    },
    GRAY: {
      bg: "bg-stone-50",
      border: "border-stone-400",
      ring: "ring-stone-400/30",
      dot: "bg-stone-400",
    },
    BROWN: {
      bg: "bg-amber-50",
      border: "border-amber-600",
      ring: "ring-amber-600/30",
      dot: "bg-amber-600",
    },
    BLACK: {
      bg: "bg-stone-100",
      border: "border-stone-800",
      ring: "ring-stone-800/30",
      dot: "bg-stone-800",
    },
  };

export const CATEGORY_COLOR_OPTIONS: { value: CategoryColor; label: string }[] =
  [
    { value: "RED", label: "Red" },
    { value: "ORANGE", label: "Orange" },
    { value: "AMBER", label: "Amber" },
    { value: "YELLOW", label: "Yellow" },
    { value: "LIME", label: "Lime" },
    { value: "GREEN", label: "Green" },
    { value: "TEAL", label: "Teal" },
    { value: "CYAN", label: "Cyan" },
    { value: "BLUE", label: "Blue" },
    { value: "INDIGO", label: "Indigo" },
    { value: "PURPLE", label: "Purple" },
    { value: "PINK", label: "Pink" },
    { value: "ROSE", label: "Rose" },
    { value: "GRAY", label: "Gray" },
    { value: "BROWN", label: "Brown" },
    { value: "BLACK", label: "Black" },
  ];

export const BUDGET_WARNING_THRESHOLD_PERCENT = 80;

export const DEFAULT_LIST_LIMIT = "100";
export const RECENT_ITEMS_LIMIT = "5";

export const APP_LOCALE = "en-US";
export const APP_CURRENCY = "USD";
export const APP_CURRENCY_SYMBOL = "$";

export const DEFAULT_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 14; // 14 days
