import { Calendar, ChartPie, Inbox, TrendingUp } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/Badge";
import { Bars } from "@/components/ui/Bars";
import { Card } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import { Tile } from "@/components/ui/Tile";
import { formatMoney } from "@/lib/format/money";
import { formatLocaleFor } from "@/lib/i18n/format-locale";
import { iconProps } from "@/lib/icons/sizes";

const CURRENCY = "COP";
const SAMPLE = {
  spent: 1_284_300,
  pending: 47_900,
  average: 42_800,
  yesterday: 38_500,
  balance: 11_258_600,
  income: 4_200_000,
  food: { spent: 412_000, limit: 600_000, left: 188_000 },
  transport: { spent: 185_500, limit: 200_000 },
  bars: [
    12, 31, 18, 22, 9, 26, 40, 38, 14, 20, 33, 12, 18, 25, 66, 20, 15, 29, 32, 12, 21, 58, 14, 9, 7,
    18, 12, 10, 8, 6,
  ],
};

// The landing shows the real home screen composition with fixed sample figures, as static HTML.
export async function PhoneMock() {
  const t = await getTranslations("public.mock");
  const locale = await getLocale();
  const money = (amount: number) =>
    formatMoney(amount, { currency: CURRENCY, locale: formatLocaleFor(locale, null) });
  return (
    <div className="mx-auto w-full max-w-[360px] rounded-[28px] border border-border bg-bg p-3 shadow-3">
      <div className="flex flex-col gap-3 rounded-[20px] bg-bg p-2">
        <div className="flex items-start justify-between px-1 pt-1">
          <span className="flex flex-col">
            <span className="text-xs font-medium tracking-caps text-text-3 uppercase">
              {t("date")}
            </span>
            <span className="text-xl font-semibold tracking-[-0.02em]">{t("greeting")}</span>
          </span>
          <span className="grid size-8 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand-text">
            {t("initials")}
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
          <Inbox {...iconProps("sm")} />
          {t("pending", { amount: money(SAMPLE.pending) })}
        </div>
        <Card className="flex flex-col gap-2 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium tracking-caps text-text-3 uppercase">
              {t("spending")}
            </span>
            <Badge tone="outline">
              <Calendar aria-hidden="true" />
              {t("dayOf")}
            </Badge>
          </div>
          <span className="text-3xl font-semibold tracking-[-0.03em] tabular-nums">
            {money(SAMPLE.spent)}
          </span>
          <span className="text-xs text-text-2">
            {t("average", { amount: money(SAMPLE.average), yesterday: money(SAMPLE.yesterday) })}
          </span>
          <Bars
            bars={SAMPLE.bars.map((value, index) => ({
              value,
              label: String(index + 1),
              today: index === 21,
            }))}
            label={t("spending")}
            height={44}
          />
          <div className="flex items-center gap-2">
            <Progress value={0.64} marker={22 / 30} label={t("progress")} className="flex-1" />
            <span className="text-xs whitespace-nowrap text-text-2">{t("progress")}</span>
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-2">
          <Card className="flex flex-col gap-0.5 p-3">
            <span className="text-xs text-text-3">{t("totalBalance")}</span>
            <span className="text-md font-semibold tabular-nums">{money(SAMPLE.balance)}</span>
            <span className="text-xs text-text-3">{t("accounts")}</span>
          </Card>
          <Card className="flex flex-col gap-0.5 p-3">
            <span className="text-xs text-text-3">{t("income")}</span>
            <span className="text-md font-semibold text-income tabular-nums">
              {money(SAMPLE.income)}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-income">
              <TrendingUp {...iconProps("sm")} className="size-3" />
              {t("sameAs")}
            </span>
          </Card>
        </div>
        <Card className="flex flex-col gap-2 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{t("budgets")}</span>
            <span className="text-xs font-medium text-brand-text">{t("seeAll")}</span>
          </div>
          {[
            {
              name: t("food"),
              color: "ORANGE" as const,
              status: t("foodStatus", { amount: money(SAMPLE.food.left) }),
              ...SAMPLE.food,
            },
            {
              name: t("transport"),
              color: "BLUE" as const,
              status: t("transportStatus"),
              ...SAMPLE.transport,
            },
          ].map((budget) => {
            const limit = ` / ${money(budget.limit)}`;
            return (
              <div key={budget.name} className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-xs">
                  <Tile size="sm" color={budget.color}>
                    <ChartPie {...iconProps("sm")} />
                  </Tile>
                  <span className="flex-1 font-medium">{budget.name}</span>
                  <span className="tabular-nums">
                    {money(budget.spent)}
                    <span className="text-text-3">{limit}</span>
                  </span>
                </div>
                <Progress
                  value={budget.spent}
                  max={budget.limit}
                  thin
                  color={budget.color}
                  label={budget.name}
                />
                <span className="text-[11px] text-text-3">{budget.status}</span>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}
