"use client";

import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { Card } from "@/components/ui/Card";
import { List, RowBody, rowClasses, RowMeta, RowTitle } from "@/components/ui/Row";
import { Sheet } from "@/components/ui/Sheet";
import { Tile } from "@/components/ui/Tile";
import { Link } from "@/lib/i18n/navigation";
import { iconProps } from "@/lib/icons/sizes";
import type { ColorToken } from "@/lib/theme/feature-color";

import { Avatar } from "./Avatar";
import { MORE_ITEMS, type NavKey, SETTINGS_ITEM } from "./nav";

export interface CategoryCounts {
  active: number;
  archived: number;
}

interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
  userName: string;
  userEmail: string;
  accountCount?: number;
  categoryCounts?: CategoryCounts;
}

const TILE_COLOR: Partial<Record<NavKey, ColorToken>> = {
  accounts: "BLUE",
  stats: "TEAL",
  categories: "ORANGE",
  settings: "GRAY",
};

export function MoreSheet({
  open,
  onClose,
  userName,
  userEmail,
  accountCount,
  categoryCounts,
}: MoreSheetProps) {
  const t = useTranslations("nav");

  function metaFor(key: NavKey) {
    if (key === "accounts")
      return accountCount === undefined ? undefined : t("moreAccounts", { count: accountCount });
    if (key === "categories")
      return categoryCounts === undefined
        ? undefined
        : t("moreCategories", { active: categoryCounts.active, archived: categoryCounts.archived });
    if (key === "stats") return t("moreStats");
    return t("moreSettings");
  }

  return (
    <Sheet open={open} onClose={onClose} title={t("more")}>
      <div className="flex flex-col gap-3">
        <Card flush>
          <List>
            {MORE_ITEMS.map((item) => {
              const meta = metaFor(item.key);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={onClose}
                  className={rowClasses({ interactive: true })}
                >
                  <Tile size="sm" color={TILE_COLOR[item.key]}>
                    <item.icon {...iconProps("sm")} />
                  </Tile>
                  <RowBody>
                    <RowTitle>
                      <span>{t(item.key)}</span>
                    </RowTitle>
                    {meta && <RowMeta items={[meta]} />}
                  </RowBody>
                  <ChevronRight {...iconProps("sm")} className="text-text-3" />
                </Link>
              );
            })}
          </List>
        </Card>
        {userName !== "" && (
          <Card flush>
            <Link
              href={SETTINGS_ITEM.href}
              onClick={onClose}
              className={rowClasses({ interactive: true })}
            >
              <Avatar name={userName} size="sm" />
              <RowBody>
                <RowTitle>
                  <span>{userName}</span>
                </RowTitle>
                {userEmail !== "" && <RowMeta items={[userEmail]} />}
              </RowBody>
              <ChevronRight {...iconProps("sm")} className="text-text-3" />
            </Link>
          </Card>
        )}
      </div>
    </Sheet>
  );
}
