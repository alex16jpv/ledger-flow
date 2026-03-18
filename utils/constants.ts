export const TRANSACTION_TYPES = {
  EXPENSE: "EXPENSE",
  INCOME: "INCOME",
  TRANSFER: "TRANSFER",
} as const;

export type TransactionKind =
  (typeof TRANSACTION_TYPES)[keyof typeof TRANSACTION_TYPES];

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

export const CATEGORY_STYLES: Record<string, CategoryStyle> = {
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
