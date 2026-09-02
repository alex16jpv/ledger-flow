import {
  Banknote,
  CircleAlert,
  CreditCard,
  HandCoins,
  Landmark,
  type LucideIcon,
  PiggyBank,
  TrendingUp,
  Wallet,
  WalletCards,
} from "lucide-react";

export const ACCOUNT_TYPE_ICONS = {
  CASH: Banknote,
  ACCOUNT: Landmark,
  CARD: CreditCard,
  DEBIT_CARD: WalletCards,
  SAVINGS: PiggyBank,
  INVESTMENT: TrendingUp,
  OVERDRAFT: CircleAlert,
  LOAN: HandCoins,
  OTHER: Wallet,
} satisfies Record<string, LucideIcon>;

export type AccountTypeKey = keyof typeof ACCOUNT_TYPE_ICONS;

export function accountTypeIcon(type: string): LucideIcon {
  return Object.hasOwn(ACCOUNT_TYPE_ICONS, type)
    ? ACCOUNT_TYPE_ICONS[type as AccountTypeKey]
    : ACCOUNT_TYPE_ICONS.OTHER;
}
