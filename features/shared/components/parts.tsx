"use client";

import { CircleX } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Amount } from "@/components/ui/Amount";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { iconProps } from "@/lib/icons/sizes";
import type { PersonState } from "@/lib/local/derive";

const STATE_TONE: Record<PersonState, BadgeTone> = {
  NOT_PAID: "neutral",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  WRITTEN_OFF: "neutral",
};

export function StateBadge({ state }: { state: PersonState }) {
  const t = useTranslations("shared.states");
  return (
    <Badge tone={STATE_TONE[state]}>
      {state === "WRITTEN_OFF" && <CircleX {...iconProps("sm")} />}
      {t(state)}
    </Badge>
  );
}

export interface TwoFiguresProps {
  owedToYou: number;
  youOwe: number;
  meta?: ReactNode;
}

// The same two-figure shape as Accounts and Home, and for the same reason: there is no net figure.
export function TwoFigures({ owedToYou, youOwe, meta }: TwoFiguresProps) {
  const t = useTranslations("shared.summary");
  return (
    <Card className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-text-3">{t("owedToYou")}</span>
        <Amount value={owedToYou} signed={false} size="hero" />
        {meta && <span className="text-sm text-text-3">{meta}</span>}
      </div>
      <div className="flex flex-col gap-1 sm:items-end">
        <span className="text-xs font-medium text-text-3">{t("youOwe")}</span>
        <Amount value={youOwe} signed={false} size="lg" />
      </div>
    </Card>
  );
}
