export type NavItem = {
  href: string;
  icon: string;
  label: string;
  disabled?: boolean;
  hideInBottomNav?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", icon: "⊞", label: "Dashboard" },
  {
    href: "/transactions/new",
    icon: "＋",
    label: "New Transaction",
    hideInBottomNav: true,
  },
  { href: "/transactions", icon: "↕", label: "Transactions" },
  { href: "/accounts", icon: "◈", label: "Accounts" },
  { href: "/budgets", icon: "◎", label: "Budgets", disabled: true },
  { href: "/reports", icon: "⌇", label: "Reports", disabled: true },
];

export const BOTTOM_NAV_ITEMS = NAV_ITEMS.filter(
  (item) => !item.hideInBottomNav && !item.disabled,
);

export function getActiveHref(
  items: NavItem[],
  pathname: string,
): string | undefined {
  return items
    .filter(
      (item) => pathname === item.href || pathname.startsWith(item.href + "/"),
    )
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}
