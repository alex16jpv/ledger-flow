"use client";

import { Users } from "lucide-react";
import { useTranslations } from "next-intl";

import { Amount } from "@/components/ui/Amount";
import { Badge } from "@/components/ui/Badge";
import { RowBody, rowClasses, RowMeta, RowRight, RowTitle } from "@/components/ui/Row";
import { Tile } from "@/components/ui/Tile";
import { Link } from "@/lib/i18n/navigation";
import { useMoney } from "@/lib/i18n/useMoney";
import { iconProps } from "@/lib/icons/sizes";
import type { JoinedGroupStanding } from "@/lib/local/derive";
import type { JoinedGroup } from "@/types/api";

import { useGroupRange } from "./GroupRowLink";
import { StateBadge } from "./parts";

// No bar: a bar that fills the other way from the rows above it is worse than none.
export function JoinedGroupRowLink({
  group,
  standing,
}: {
  group: JoinedGroup;
  standing: JoinedGroupStanding;
}) {
  const t = useTranslations("shared");
  const money = useMoney();
  const range = useGroupRange();
  const meta = [
    t("joined.sharedBy", { name: group.ownerName }),
    range(standing.dateFrom, standing.dateTo),
    t("groups.people", { count: group.participants.length }),
  ].filter(Boolean);
  const owesSomething = standing.owedToOwner > 0 || standing.state === "WRITTEN_OFF";

  return (
    <Link href={`/shared/joined/${group.id}`} className={rowClasses({ interactive: true })}>
      <Tile color={group.color}>
        <Users {...iconProps("md")} />
      </Tile>
      <RowBody>
        <RowTitle>
          <span>{group.name}</span>
          {group.archivedAt !== null && <Badge>{t("groups.archived")}</Badge>}
          {owesSomething && <StateBadge state={standing.state} />}
        </RowTitle>
        <RowMeta items={meta} />
      </RowBody>
      <RowRight sub={t("groups.yourShare", { amount: money.format(standing.yourShare) })}>
        <Amount value={standing.amount} signed={false} />
      </RowRight>
    </Link>
  );
}
