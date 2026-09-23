"use client";

import { HandCoins } from "lucide-react";
import { useTranslations } from "next-intl";

import { Amount } from "@/components/ui/Amount";
import { RowBody, RowButton, RowMeta, RowRight, RowTitle } from "@/components/ui/Row";
import { SyncBadge } from "@/components/ui/SyncBadge";
import { Tile } from "@/components/ui/Tile";
import { rowSync, type SharedPending } from "@/features/shared/pending";
import { useDates } from "@/lib/i18n/useDates";
import { useMoney } from "@/lib/i18n/useMoney";
import { iconProps } from "@/lib/icons/sizes";
import { fromCents, toCents } from "@/lib/local/derive/money";
import type { Settlement } from "@/types/api";

export interface PaymentRowsProps {
  rows: Settlement[];
  pending: SharedPending;
  onUndo: (settlement: Settlement) => void;
}

// One list for the two places a payment is read from: a person, and the expense a block lives in.
export function PaymentRows({ rows, pending, onUndo }: PaymentRowsProps) {
  const t = useTranslations("shared.person");
  const states = useTranslations("states");
  const money = useMoney();
  const dates = useDates();
  return (
    <>
      {rows.map((one) => {
        // A full settle-up carries both halves: one row, so it names the net that changed hands.
        const net = toCents(one.collected) - toCents(one.paid);
        const incoming = net >= 0;
        const amount = fromCents(Math.abs(net));
        const sync = rowSync(pending, one.id);
        return (
          // The one thing that can be done to a payment is undoing it, and this is where it is read.
          <RowButton
            key={one.id}
            onClick={() => {
              onUndo(one);
            }}
          >
            <Tile color="GRAY">
              <HandCoins {...iconProps("md")} />
            </Tile>
            <RowBody>
              <RowTitle>
                <span>
                  {incoming
                    ? t("paidYou", { amount: money.format(amount) })
                    : t("youPaid", { amount: money.format(amount) })}
                </span>
                {sync && <SyncBadge sync={sync} />}
              </RowTitle>
              <RowMeta
                items={[
                  dates.formatDay(new Date(one.date)),
                  // Cash the app never saw: no movement was written and no balance moved.
                  one.outsideApp ? t("outsideApp") : null,
                  sync ? states("savedHere") : null,
                ].filter(Boolean)}
              />
            </RowBody>
            <RowRight>
              <Amount value={amount} kind={incoming ? "settlement" : "settlementOut"} />
            </RowRight>
          </RowButton>
        );
      })}
    </>
  );
}
