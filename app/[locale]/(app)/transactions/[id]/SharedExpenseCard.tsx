"use client";

import { HandCoins, Split, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Avatar } from "@/components/shell/Avatar";
import { Amount } from "@/components/ui/Amount";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { List, Row, RowBody, RowRight, RowTitle } from "@/components/ui/Row";
import { Tile } from "@/components/ui/Tile";
import { StateBadge } from "@/features/shared/components/parts";
import { type GroupView, type PartyView, type SharedSection } from "@/features/shared/ledger";
import { useDates } from "@/lib/i18n/useDates";
import { useMoney } from "@/lib/i18n/useMoney";
import { iconProps } from "@/lib/icons/sizes";
import type { PersonState } from "@/lib/local/derive";
import { fromCents, toCents } from "@/lib/local/derive/money";
import type { SharedExpense, Transaction } from "@/types/api";

import { EditSplitSheet } from "../../shared/EditSplitSheet";
import { SettleUpFlow } from "../../shared/SettleUpFlow";

export interface SharedExpenseCardProps {
  row: Transaction;
  section: SharedSection;
  view: GroupView;
  expense: SharedExpense;
}

interface ShareRow {
  key: string;
  name: string;
  color: PartyView["color"];
  guests: boolean;
  share: number;
  state: PersonState;
}

// A participant can read `Paid` here and `Partially paid` in the group: oldest expense first.
function sharesOf(section: SharedSection, view: GroupView, expense: SharedExpense): ShareRow[] {
  const rows: ShareRow[] = [];
  for (const share of expense.split.shares) {
    if (share.party === "USER") continue;
    const key =
      share.party === "GUESTS" ? `guests:${expense.id}` : `contact:${share.contactId ?? ""}`;
    const person = view.people.find((one) => one.key === key);
    const covered = toCents(section.collected.get(`${expense.id}|${key}`) ?? 0);
    const owed = toCents(share.amount);
    rows.push({
      key,
      name: person?.name ?? "",
      color: person?.color ?? null,
      guests: share.party === "GUESTS",
      share: share.amount,
      state:
        person?.state === "WRITTEN_OFF" && covered < owed
          ? "WRITTEN_OFF"
          : covered >= owed
            ? "PAID"
            : covered > 0
              ? "PARTIALLY_PAID"
              : "NOT_PAID",
    });
  }
  return rows;
}

// Who this one expense still has something open with, which is who its own actions can reach.
export function owingParties(
  section: SharedSection,
  view: GroupView,
  expense: SharedExpense,
): PartyView[] {
  const keys = new Set(sharesOf(section, view, expense).map((one) => one.key));
  return view.people.filter(
    (person) =>
      keys.has(person.key) && (person.owesYou > 0 || person.youOwe > 0 || person.surplus > 0),
  );
}

export function SharedExpenseCard({ row, section, view, expense }: SharedExpenseCardProps) {
  const t = useTranslations("transactions.detail.shared");
  const money = useMoney();
  const dates = useDates();
  const [editing, setEditing] = useState(false);
  const [settling, setSettling] = useState(false);
  const yours = expense.split.shares.find((share) => share.party === "USER")?.amount ?? 0;
  const countsAsYours = fromCents(
    toCents(row.amount) - toCents(section.cameBack.get(expense.id) ?? 0),
  );
  const shares = sharesOf(section, view, expense);
  const owing = owingParties(section, view, expense);
  const open = shares
    .filter((one) => one.state === "NOT_PAID" || one.state === "PARTIALLY_PAID")
    .reduce(
      (cents, one) =>
        cents +
        toCents(one.share) -
        toCents(section.collected.get(`${expense.id}|${one.key}`) ?? 0),
      0,
    );
  const writtenOff = shares
    .filter((one) => one.state === "WRITTEN_OFF")
    .reduce(
      (cents, one) =>
        cents +
        toCents(one.share) -
        toCents(section.collected.get(`${expense.id}|${one.key}`) ?? 0),
      0,
    );

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium tracking-caps text-text-3 uppercase">
          {t("countsAsYours")}
        </span>
        <Amount value={countsAsYours} signed={false} size="lg" />
        <span className="text-sm text-text-3">
          {writtenOff > 0
            ? t("leadWithWriteOff", {
                share: money.format(yours),
                owed: money.format(fromCents(open)),
                writtenOff: money.format(fromCents(writtenOff)),
              })
            : open > 0
              ? t("lead", { share: money.format(yours), owed: money.format(fromCents(open)) })
              : t("leadSettled", { share: money.format(yours) })}
        </span>
      </div>
      <List>
        {shares.map((one) => (
          <Row key={one.key}>
            {one.guests ? (
              <Tile color="GRAY">
                <Users {...iconProps("md")} />
              </Tile>
            ) : (
              <Avatar name={one.name} color={one.color} />
            )}
            <RowBody>
              <RowTitle>
                <span>{one.name}</span>
                <StateBadge state={one.state} />
              </RowTitle>
            </RowBody>
            <RowRight sub={t("share")}>
              <Amount value={one.share} signed={false} />
            </RowRight>
          </Row>
        ))}
      </List>
      <div className="flex gap-3">
        <Button
          variant="secondary"
          className="flex-1"
          onClick={() => {
            setEditing(true);
          }}
        >
          <Split {...iconProps("sm")} />
          {t("editSplit")}
        </Button>
        <Button
          variant="secondary"
          className="flex-1"
          disabled={owing.length === 0}
          onClick={() => {
            setSettling(true);
          }}
        >
          <HandCoins {...iconProps("sm")} />
          {t("settleUp")}
        </Button>
      </div>
      {row.sharedHistory.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-border pt-3">
          <span className="text-xs font-medium tracking-caps text-text-3 uppercase">
            {t("history")}
          </span>
          {row.sharedHistory.map((entry, index) => (
            <div
              key={`${entry.at}-${String(index)}`}
              className="flex items-baseline justify-between gap-3 text-sm"
            >
              <span className="min-w-0 truncate">
                <span className="text-text-3">{dates.formatDay(new Date(entry.at))}</span>{" "}
                {t(`reasons.${entry.reason}`)}
              </span>
              <span className="font-mono tabular-nums">{money.format(entry.countsAsYours)}</span>
            </div>
          ))}
        </div>
      )}
      <EditSplitSheet
        group={view.group}
        expense={expense}
        open={editing}
        onClose={() => {
          setEditing(false);
        }}
      />
      <SettleUpFlow
        section={section}
        view={view}
        parties={owing}
        open={settling}
        onClose={() => {
          setSettling(false);
        }}
      />
    </Card>
  );
}
