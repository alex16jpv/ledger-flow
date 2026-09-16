import type { LucideIcon } from "lucide-react";
import { ChartColumn, ChartPie, Ellipsis, House, List, Settings, Tags, Wallet } from "lucide-react";

export type NavKey =
  "home" | "transactions" | "budgets" | "accounts" | "stats" | "categories" | "settings";

export interface NavItem {
  key: NavKey;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { key: "home", href: "/home", icon: House },
  { key: "transactions", href: "/transactions", icon: List },
  { key: "budgets", href: "/budgets", icon: ChartPie },
  { key: "accounts", href: "/accounts", icon: Wallet },
  { key: "stats", href: "/stats", icon: ChartColumn },
  { key: "categories", href: "/categories", icon: Tags },
];

export const SETTINGS_ITEM: NavItem = { key: "settings", href: "/settings", icon: Settings };

export type TabSlot = NavKey | "add" | "more";

export const TAB_SLOTS: readonly TabSlot[] = ["home", "transactions", "add", "budgets", "more"];

export const MORE_ICON: LucideIcon = Ellipsis;

const IN_THE_BAR = new Set<string>(TAB_SLOTS);

export const MORE_ITEMS: readonly NavItem[] = [
  ...NAV_ITEMS.filter((item) => !IN_THE_BAR.has(item.key)),
  SETTINGS_ITEM,
];

export const ADD_HREF = "/transactions/new";

export interface AddOptions {
  chain: boolean;
}

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
