"use client";

import { ArrowLeftRight, Percent, Repeat } from "lucide-react";
import { useTranslations } from "next-intl";

import { Alert } from "@/components/ui/Alert";
import { Amount } from "@/components/ui/Amount";
import { Badge } from "@/components/ui/Badge";
import { List, Row, RowBody, RowMeta, RowRight, RowTitle } from "@/components/ui/Row";
import { Tile } from "@/components/ui/Tile";
import { useMoney } from "@/lib/i18n/useMoney";
import { iconProps } from "@/lib/icons/sizes";
import type { Account } from "@/types/api";

import { sideKey } from "./TransferReadback";

type ReadbackAccount = Pick<Account, "name" | "type" | "balance">;

export type HalfState = "pending" | "saved" | "refused";

export interface InstalmentReadbackProps {
  from: ReadbackAccount;
  to: ReadbackAccount;
  instalment: number;
  interest: number;
  interestCategory: string;
  transfer?: HalfState;
  expense?: HalfState;
}

export function InstalmentReadback({
  from,
  to,
  instalment,
  interest,
  interestCategory,
  transfer = "pending",
  expense = "pending",
}: InstalmentReadbackProps) {
  const t = useTranslations();
  const money = useMoney();
  const principal = instalment - interest;
  const half = transfer === "saved" && expense !== "saved";

  const badge = (state: HalfState) =>
    state === "pending" ? null : (
      <Badge tone={state === "saved" ? "success" : "danger"}>
        {t(`accounts.pay.instalment.${state}`)}
      </Badge>
    );

  return (
    <div className="flex flex-col gap-2">
      <Alert tone={half ? "warning" : "neutral"} icon={ArrowLeftRight}>
        {half
          ? t("accounts.pay.instalment.halfArrived", {
              principal: money.format(principal),
              interest: money.format(interest),
            })
          : t("accounts.pay.instalment.readSplit", {
              left: t(`transactions.readback.${sideKey(from, false)}`, {
                name: from.name,
                amount: money.format(instalment),
              }),
              right: t(`transactions.readback.${sideKey(to, true)}`, {
                name: to.name,
                amount: money.format(principal),
              }),
              interest: money.format(interest),
              category: interestCategory,
            })}
      </Alert>
      <List className="rounded-xl border border-border">
        <Row>
          <Tile size="sm" color={null}>
            <Repeat {...iconProps("sm")} />
          </Tile>
          <RowBody>
            <RowTitle>
              <span>{t("accounts.pay.instalment.transferRow", { name: to.name })}</span>
              {badge(transfer)}
            </RowTitle>
            <RowMeta items={[t("accounts.pay.instalment.transferMeta")]} />
          </RowBody>
          <RowRight>
            <Amount value={principal} signed={false} />
          </RowRight>
        </Row>
        <Row className="border-t border-border">
          <Tile size="sm" color={null}>
            <Percent {...iconProps("sm")} />
          </Tile>
          <RowBody>
            <RowTitle>
              <span>{t("accounts.pay.instalment.expenseRow", { name: to.name })}</span>
              {badge(expense)}
            </RowTitle>
            <RowMeta
              items={[t("accounts.pay.instalment.expenseMeta", { category: interestCategory })]}
            />
          </RowBody>
          <RowRight>
            <Amount value={interest} signed={false} />
          </RowRight>
        </Row>
      </List>
    </div>
  );
}
