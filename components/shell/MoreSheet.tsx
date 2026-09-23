"use client";

import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { List, RowBody, rowClasses, RowMeta, RowTitle } from "@/components/ui/Row";
import { Sheet } from "@/components/ui/Sheet";
import { Tile } from "@/components/ui/Tile";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { useMoney } from "@/lib/i18n/useMoney";
import { iconProps } from "@/lib/icons/sizes";
import type { ColorToken } from "@/lib/theme/feature-color";

import { Avatar } from "./Avatar";
import { isActive, MORE_ITEMS, type NavKey, SETTINGS_ITEM } from "./nav";

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
  owedToYou?: number;
  invitations?: number;
}

const TILE_COLOR: Partial<Record<NavKey, ColorToken>> = {
  accounts: "BLUE",
  shared: "PURPLE",
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
  owedToYou,
  invitations = 0,
}: MoreSheetProps) {
  const t = useTranslations();
  const money = useMoney();
  const pathname = usePathname();

  function metaFor(key: NavKey) {
    if (key === "accounts")
      return accountCount === undefined
        ? undefined
        : t("home.accountsCount", { count: accountCount });
    if (key === "categories")
      return categoryCounts === undefined
        ? undefined
        : t("settings.categories.subtitle", {
            active: categoryCounts.active,
            archived: categoryCounts.archived,
          });
    if (key === "shared" && invitations > 0)
      return t("nav.moreInvitations", { count: invitations });
    if (key === "shared")
      return owedToYou === undefined
        ? undefined
        : t("nav.moreShared", { amount: money.format(owedToYou) });
    if (key === "stats") return t("nav.moreStats");
    if (key === "settings") return t("nav.moreSettings");
    return undefined;
  }

  return (
    <Sheet open={open} onClose={onClose} title={t("nav.more")}>
      <div className="flex flex-col gap-3">
        <Card flush>
          <List>
            {MORE_ITEMS.map((item) => {
              const meta = metaFor(item.key);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={isActive(pathname, item.href) ? "page" : undefined}
                  onClick={onClose}
                  className={rowClasses({ interactive: true })}
                >
                  <Tile size="sm" color={TILE_COLOR[item.key]}>
                    <item.icon {...iconProps("sm")} />
                  </Tile>
                  <RowBody>
                    <RowTitle>
                      <span>{t(`nav.${item.key}`)}</span>
                    </RowTitle>
                    {meta && <RowMeta items={[meta]} />}
                  </RowBody>
                  {item.key === "shared" && invitations > 0 && (
                    <Badge tone="brand">
                      <span aria-hidden="true">{invitations}</span>
                      <span className="sr-only">
                        {t("nav.waitingCount", { count: invitations })}
                      </span>
                    </Badge>
                  )}
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
