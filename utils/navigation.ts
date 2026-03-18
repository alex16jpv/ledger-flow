export type NavItem = {
  href: string;
  icon: string;
  label: string;
  disabled?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", icon: "⊞", label: "Dashboard" },
  { href: "/transactions/new", icon: "＋", label: "New Transaction" },
  { href: "/transactions", icon: "↕", label: "Transactions" },
  { href: "/accounts", icon: "◈", label: "Accounts", disabled: true },
  { href: "/budgets", icon: "◎", label: "Budgets", disabled: true },
  { href: "/reports", icon: "⌇", label: "Reports", disabled: true },
];
