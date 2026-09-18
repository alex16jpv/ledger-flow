"use client";

import { CircleHelp, Repeat, TrendingDown, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { createElement, useState } from "react";

import { Button } from "@/components/ui/Button";
import { List, Row, RowBody, RowMeta, RowTitle } from "@/components/ui/Row";
import { Sheet } from "@/components/ui/Sheet";
import { Tile } from "@/components/ui/Tile";
import { iconProps } from "@/lib/icons/sizes";
import type { ColorToken } from "@/lib/theme/feature-color";

import { FORM_TYPES, type FormTransactionType } from "../form";

const TYPE_TILE: Record<FormTransactionType, { icon: typeof Repeat; color: ColorToken }> = {
  EXPENSE: { icon: TrendingDown, color: "RED" },
  INCOME: { icon: TrendingUp, color: "GREEN" },
  TRANSFER: { icon: Repeat, color: "GRAY" },
};

export function TypeLine({ type }: { type: FormTransactionType }) {
  const t = useTranslations("transactions.form");
  const types = useTranslations("transactionTypes");
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-start gap-2">
      <p className="flex-1 text-sm text-text-3">{t(`typeLine.${type}`)}</p>
      <Button
        variant="secondary"
        size="sm"
        iconOnly
        round
        className="shrink-0"
        aria-haspopup="dialog"
        aria-label={t("typesHelp")}
        onClick={() => {
          setOpen(true);
        }}
      >
        <CircleHelp {...iconProps("sm")} />
      </Button>
      <Sheet
        open={open}
        title={t("typesHelp")}
        onClose={() => {
          setOpen(false);
        }}
      >
        <List>
          {open &&
            FORM_TYPES.map((value) => (
              <Row key={value}>
                <Tile color={TYPE_TILE[value].color}>
                  {createElement(TYPE_TILE[value].icon, iconProps("md"))}
                </Tile>
                <RowBody>
                  <RowTitle>{types(value)}</RowTitle>
                  <RowMeta items={[t(`typeLine.${value}`)]} />
                </RowBody>
              </Row>
            ))}
        </List>
      </Sheet>
    </div>
  );
}
