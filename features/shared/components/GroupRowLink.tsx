"use client";

import { Users } from "lucide-react";
import { useTranslations } from "next-intl";

import { Amount } from "@/components/ui/Amount";
import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import { Projected } from "@/components/ui/Projected";
import { RowBody, rowClasses, RowMeta, RowRight, RowTitle } from "@/components/ui/Row";
import { SyncBadge } from "@/components/ui/SyncBadge";
import { Tile } from "@/components/ui/Tile";
import { Link } from "@/lib/i18n/navigation";
import { useDates } from "@/lib/i18n/useDates";
import { useMoney } from "@/lib/i18n/useMoney";
import { iconProps } from "@/lib/icons/sizes";

import type { GroupView } from "../ledger";
import { rowSync, type SharedPending } from "../pending";

export function useGroupRange(): (from: string | null, to: string | null) => string {
  const dates = useDates();
  return (from, to) =>
    from === null || to === null ? "" : dates.formatRange(new Date(from), new Date(to));
}

export function GroupRowLink({ view, pending }: { view: GroupView; pending: SharedPending }) {
  const t = useTranslations("shared.groups");
  const states = useTranslations("states");
  const money = useMoney();
  const range = useGroupRange();
  const { group } = view;
  const sync = rowSync(pending, group.id);
  const projected = pending.groups.has(group.id);
  const meta = [
    range(group.totals.dateFrom, group.totals.dateTo),
    t("people", { count: group.participants.length }),
    sync && states("savedHere"),
  ].filter(Boolean);

  return (
    <Link href={`/shared/groups/${group.id}`} className={rowClasses({ interactive: true })}>
      <Tile color={group.color}>
        <Users {...iconProps("md")} />
      </Tile>
      <RowBody>
        <RowTitle>
          <span>{group.name}</span>
          {sync && <SyncBadge sync={sync} />}
          {group.archivedAt !== null && <Badge>{t("archived")}</Badge>}
          {group.status === "SETTLED" && group.archivedAt === null && (
            <Badge tone="success">{t("settledBadge")}</Badge>
          )}
          {/* A group where nothing is owed to you has no bar at all, only what you owe. */}
          {view.owed === 0 && view.youOwe > 0 && (
            <Badge>{t("youOwe", { amount: money.format(view.youOwe) })}</Badge>
          )}
        </RowTitle>
        <RowMeta items={meta} />
        {view.barTotal > 0 && (
          <span className="flex flex-col gap-[3px] pt-1.5">
            <Projected when={projected} align="center" className="w-full">
              <Progress
                thin
                plain
                value={view.collected}
                max={view.barTotal}
                color={group.color}
                label={t("barLabel", { name: group.name })}
                className="flex-1"
              />
            </Projected>
            <span className="text-xs text-text-3">
              {t("bar", {
                paid: money.format(view.collected),
                total: money.format(view.barTotal),
              })}
            </span>
          </span>
        )}
      </RowBody>
      <RowRight sub={t("yourShare", { amount: money.format(group.totals.yourShare) })}>
        <Projected when={projected}>
          <Amount value={group.totals.amount} signed={false} />
        </Projected>
      </RowRight>
    </Link>
  );
}
