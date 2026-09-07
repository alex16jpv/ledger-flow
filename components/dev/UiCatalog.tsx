"use client";

import { Briefcase, Check, Coffee, Inbox, Star, Utensils } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useState } from "react";

import {
  AccountCard,
  AccountCardGrid,
  Alert,
  Amount,
  AmountInput,
  Badge,
  Banner,
  Bars,
  Button,
  Card,
  CategoryChip,
  Chip,
  ChipRow,
  DayHeader,
  Dot,
  Empty,
  Field,
  Input,
  List,
  PeriodNav,
  Picker,
  Progress,
  Row,
  RowBody,
  RowMeta,
  RowRight,
  RowTitle,
  Segment,
  Sheet,
  Skeleton,
  Stat,
  SwatchGrid,
  Switch,
  Tag,
  Tile,
  Toast,
  ToastProvider,
  useToast,
} from "@/components/ui";
import { CATEGORY_ICON_KEYS, CategoryIcon } from "@/lib/icons";
import { iconProps } from "@/lib/icons/sizes";
import {
  COLOR_TOKENS,
  type ColorToken,
  isMode,
  isPalette,
  MODES,
  PALETTES,
  useTheme,
} from "@/lib/theme";

function Section({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-medium tracking-caps text-text-3 uppercase">{title}</h2>
      {children}
    </section>
  );
}

function ThemeControls() {
  const t = useTranslations("dev");
  const ts = useTranslations("settings.appearance");
  const theme = useTheme();
  const { setMode, setPalette } = theme;
  const params = useSearchParams();
  const requestedMode = params.get("mode");
  const requestedPalette = params.get("palette");

  useEffect(() => {
    if (isMode(requestedMode)) setMode(requestedMode);
    if (isPalette(requestedPalette)) setPalette(requestedPalette);
  }, [requestedMode, requestedPalette, setMode, setPalette]);
  return (
    <div className="flex flex-wrap gap-4">
      <Segment
        inline
        label={t("palette")}
        value={theme.palette}
        onChange={theme.setPalette}
        options={PALETTES.map((palette) => ({
          value: palette,
          label: ts(`palettes.${palette}.name`),
        }))}
      />
      <Segment
        inline
        label={t("mode")}
        value={theme.mode}
        onChange={theme.setMode}
        options={MODES.map((mode) => ({ value: mode, label: ts(mode) }))}
      />
    </div>
  );
}

function ToastDemo() {
  const t = useTranslations("dev");
  const tc = useTranslations("common");
  const toast = useToast();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Toast action={{ label: tc("undo"), onClick: () => undefined }}>{t("sample.saved")}</Toast>
      <Button
        variant="secondary"
        onClick={() => {
          toast.show({
            message: t("sample.saved"),
            action: { label: tc("undo"), onClick: () => undefined },
          });
        }}
      >
        {t("showToast")}
      </Button>
    </div>
  );
}

const SURFACES = [
  { name: "bg", className: "bg-bg" },
  { name: "surface", className: "bg-surface" },
  { name: "surface-2", className: "bg-surface-2" },
  { name: "surface-3", className: "bg-surface-3" },
] as const;

const SAMPLE_TAG = "coffee";

const TYPE_SCALE = {
  h1: "h1 / 24",
  h2: "h2 / 17",
  h3: "h3 / 15",
  base: "base / 14",
  small: "small / 12",
  eyebrow: "eyebrow / 11",
  hero: "amount-hero / 40",
  mono: "mono / 12",
} as const;

const SEGMENT_OPTIONS = [
  { value: "EXPENSE", key: "expense", tone: "default" },
  { value: "INCOME", key: "income", tone: "income" },
  { value: "TRANSFER", key: "transfer", tone: "transfer" },
  { value: "ADJUSTMENT", key: "adjustment", tone: "default" },
] as const;

export function UiCatalog() {
  const t = useTranslations("dev");
  const tc = useTranslations("common");
  const tColors = useTranslations("colors");
  const [segment, setSegment] = useState<(typeof SEGMENT_OPTIONS)[number]["value"]>("EXPENSE");
  const [swatch, setSwatch] = useState<ColorToken | null>("BLUE");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [checked, setChecked] = useState(true);
  const [chip, setChip] = useState("food");

  const bars = Array.from({ length: 22 }, (_, index) => ({
    value:
      [12, 30, 0, 45, 22, 60, 15, 0, 38, 80, 25, 10, 44, 0, 70, 33, 18, 52, 0, 90, 41, 20][index] ??
      0,
    label: `${index + 1}`,
    today: index === 21,
  }));

  return (
    <ToastProvider>
      <main className="mx-auto flex w-full max-w-(--content-max) flex-col gap-8 px-4 py-6 md:px-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">{t("title")}</h1>
          <p className="text-text-2">{t("subtitle")}</p>
          <ThemeControls />
        </header>

        <Section title={t("colors")}>
          <div className="grid grid-cols-4 gap-3.5 sm:grid-cols-8">
            {COLOR_TOKENS.map((token) => (
              <div key={token} className="flex flex-col items-center gap-1.5">
                <Tile size="lg" color={token}>
                  <Utensils {...iconProps("lg")} />
                </Tile>
                <Dot color={token} className="size-3.5" />
                <Badge className="bg-(--f-soft) text-(--f-text)" style={undefined}>
                  <span
                    className="contents"
                    style={{ color: `var(--c-${token.toLowerCase()}-text)` }}
                  >
                    {tColors(token)}
                  </span>
                </Badge>
              </div>
            ))}
          </div>
        </Section>

        <Section title={t("surfaces")}>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {SURFACES.map((surface) => (
              <div
                key={surface.name}
                className={`rounded-md border border-border p-2.5 ${surface.className}`}
              >
                <span className="font-mono text-xs text-text-2">{surface.name}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title={t("buttons")}>
          <div className="flex flex-wrap gap-2.5">
            <Button>{t("sample.field")}</Button>
            <Button variant="secondary">{t("sample.field")}</Button>
            <Button variant="soft">{t("sample.field")}</Button>
            <Button variant="ghost">{t("sample.field")}</Button>
            <Button variant="danger">{t("sample.field")}</Button>
            <Button variant="ink">{t("sample.field")}</Button>
            <Button loading>{t("sample.field")}</Button>
            <Button size="sm">{t("sample.field")}</Button>
            <Button size="lg">{t("sample.field")}</Button>
          </div>
        </Section>

        <Section title={t("amounts")}>
          <div className="flex flex-wrap items-center gap-4">
            <Amount value={48200} />
            <Amount value={4200000} kind="income" />
            <Amount value={1000000} kind="transfer" />
            <Amount value={1500} kind="adjustment" />
            <Badge tone="warning">
              <Inbox aria-hidden="true" />
              {t("sample.toReview")}
            </Badge>
            <Badge tone="success">
              <Check aria-hidden="true" />
              {t("sample.onTrack")}
            </Badge>
            <Badge tone="danger">{t("sample.overBudget")}</Badge>
            <Badge tone="info">{t("sample.transfer")}</Badge>
            <Badge>{t("sample.archived")}</Badge>
            <Badge tone="brand">
              <Star aria-hidden="true" />
              {t("sample.main")}
            </Badge>
            <Tag label={SAMPLE_TAG} />
          </div>
        </Section>

        <Section title={t("rows")}>
          <Card flush className="max-w-[520px]">
            <List>
              <DayHeader label={tc("today")} total={<Amount value={9800} size="sm" />} />
              <Row>
                <Tile color="BROWN">
                  <Coffee {...iconProps("md")} />
                </Tile>
                <RowBody>
                  <RowTitle>
                    <span>{t("sample.coffee")}</span>
                  </RowTitle>
                  <RowMeta items={[`${tc("today")} 7:55`, t("sample.cash")]} />
                </RowBody>
                <RowRight sub={`#${SAMPLE_TAG}`}>
                  <Amount value={9800} />
                </RowRight>
              </Row>
              <Row pending>
                <Tile color="GREEN">
                  <Briefcase {...iconProps("md")} />
                </Tile>
                <RowBody>
                  <RowTitle>
                    <span>{t("sample.salary")}</span>
                    <Badge tone="warning">{t("sample.toReview")}</Badge>
                  </RowTitle>
                  <RowMeta items={[tc("yesterday"), t("sample.bank")]} />
                </RowBody>
                <RowRight>
                  <Amount value={4200000} kind="income" />
                </RowRight>
              </Row>
            </List>
          </Card>
        </Section>

        <Section title={t("forms")}>
          <Card className="flex max-w-[520px] flex-col gap-3">
            <Field label={t("sample.field")} optional>
              <Input defaultValue={t("sample.fieldValue")} />
            </Field>
            <Field label={t("sample.withError")} error={t("sample.noDecimals")}>
              <Input defaultValue="1000.50" inputMode="decimal" />
            </Field>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-text-2">{t("sample.toReview")}</span>
              <Switch checked={checked} onCheckedChange={setChecked} label={t("sample.toReview")} />
            </div>
            <AmountInput
              label={t("sample.amount")}
              defaultValue={48200}
              onChange={() => undefined}
            />
            <Segment
              label={t("sample.type")}
              value={segment}
              onChange={setSegment}
              options={SEGMENT_OPTIONS.map((option) => ({
                value: option.value,
                label: t(`sample.${option.key}`),
                tone: option.tone,
              }))}
            />
            <Progress value={68} max={100} color="ORANGE" label={t("progress")} marker={0.72} />
            <Progress value={93} max={100} label={t("progress")} />
            <Progress value={110} max={100} label={t("progress")} />
          </Card>
        </Section>

        <Section title={t("chips")}>
          <ChipRow>
            <Chip
              selected={chip === "all"}
              onClick={() => {
                setChip("all");
              }}
            >
              {tc("more")}
            </Chip>
            <CategoryChip
              color="ORANGE"
              icon={<Utensils />}
              selected={chip === "food"}
              onClick={() => {
                setChip("food");
              }}
            >
              {t("sample.expense")}
            </CategoryChip>
            <CategoryChip
              color="BROWN"
              icon={<Coffee />}
              selected={chip === "coffee"}
              onClick={() => {
                setChip("coffee");
              }}
            >
              {t("sample.coffee")}
            </CategoryChip>
          </ChipRow>
        </Section>

        <Section title={t("pickers")}>
          <div className="flex max-w-[520px] flex-col gap-3">
            <Picker
              label={t("sample.account")}
              value={t("sample.bank")}
              leading={
                <Tile size="sm" color="BLUE">
                  <Briefcase {...iconProps("sm")} />
                </Tile>
              }
            />
            <Picker label={t("sample.account")} placeholder={t("sample.chooseAccount")} />
            <Button
              variant="secondary"
              onClick={() => {
                setSheetOpen(true);
              }}
            >
              {t("openSheet")}
            </Button>
            <Sheet
              open={sheetOpen}
              onClose={() => {
                setSheetOpen(false);
              }}
              title={t("sample.sheetTitle")}
            >
              <p className="text-sm text-text-2">{t("sample.sheetBody")}</p>
            </Sheet>
          </div>
        </Section>

        <Section title={t("feedback")}>
          <div className="flex max-w-[520px] flex-col gap-3">
            <Alert tone="warning" title={t("sample.mainAccount")}>
              {t("sample.mainAccountBody")}
            </Alert>
            <Alert tone="danger">{t("sample.noDecimals")}</Alert>
            <Alert tone="info">{t("sample.sheetBody")}</Alert>
            <ToastDemo />
          </div>
        </Section>

        <Section title={t("skeleton")}>
          <div className="flex max-w-[520px] items-center gap-3">
            <Skeleton className="size-10 rounded-[12px]" />
            <span className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3 w-3/5" />
              <Skeleton className="h-2.5 w-[35%]" />
            </span>
          </div>
        </Section>

        <Section title={t("stats")}>
          <Card className="flex max-w-[520px] flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Stat
                label={t("sample.totalBalance")}
                value={<Amount value={11258600} kind="transfer" signed={false} size="lg" />}
                delta={{ direction: "up", label: t("sample.accountsCount") }}
              />
              <Stat
                label={t("sample.eyebrow")}
                value={<Amount value={1284300} signed={false} size="lg" />}
              />
            </div>
            <Bars bars={bars} label={t("sample.spendingPerDay")} />
          </Card>
        </Section>

        <Section title={t("accounts")}>
          <AccountCardGrid label={t("accounts")}>
            <AccountCard
              name={t("sample.bank")}
              typeLabel={t("sample.bankAccount")}
              balance={<Amount value={3420500} signed={false} size="lg" />}
              color="BLUE"
              mainLabel={t("sample.main")}
            />
            <AccountCard
              name={t("sample.cash")}
              typeLabel={t("sample.cash")}
              balance={<Amount value={184000} signed={false} size="lg" />}
              color="GRAY"
            />
            <AccountCard
              name="Visa Gold"
              typeLabel={t("sample.creditCard")}
              balance={<Amount value={-1245900} signed={false} size="lg" />}
              color="PURPLE"
            />
          </AccountCardGrid>
        </Section>

        <Section title={t("period")}>
          <PeriodNav
            label={t("sample.month")}
            onPrevious={() => undefined}
            onNext={() => undefined}
            previousLabel={t("sample.previous")}
            nextLabel={t("sample.next")}
            nextDisabled
            className="max-w-[520px]"
          />
        </Section>

        <Section title={t("banner")}>
          <div className="flex flex-col gap-2 overflow-hidden rounded-lg border border-border">
            <Banner variant="offline" title={t("sample.offline")} body={t("sample.offlineBody")} />
            <Banner variant="online" title={t("sample.offline")} />
            <Banner
              variant="error"
              title={t("sample.offline")}
              action={{ label: tc("retry"), onClick: () => undefined }}
            />
          </div>
        </Section>

        <Section title={t("swatches")}>
          <SwatchGrid value={swatch} onChange={setSwatch} label={t("sample.color")} />
        </Section>

        <Section title={t("empty")}>
          <Card className="max-w-[520px]">
            <Empty
              icon={<Inbox {...iconProps("lg")} />}
              title={t("sample.emptyTitle")}
              body={t("sample.emptyBody")}
              action={<Button>{t("sample.emptyCta")}</Button>}
            />
          </Card>
        </Section>

        <Section title={t("typography")}>
          <Card className="grid max-w-[720px] grid-cols-[160px_1fr] items-baseline gap-x-6 gap-y-3.5">
            <span className="font-mono text-xs text-text-3">{TYPE_SCALE.h1}</span>
            <span className="text-2xl font-semibold tracking-[-0.02em]">{t("sample.hi")}</span>
            <span className="font-mono text-xs text-text-3">{TYPE_SCALE.h2}</span>
            <span className="text-lg font-semibold">{t("sample.newTransaction")}</span>
            <span className="font-mono text-xs text-text-3">{TYPE_SCALE.h3}</span>
            <span className="text-md font-semibold">{t("sample.budgets")}</span>
            <span className="font-mono text-xs text-text-3">{TYPE_SCALE.base}</span>
            <span>{t("sample.body")}</span>
            <span className="font-mono text-xs text-text-3">{TYPE_SCALE.small}</span>
            <span className="text-sm text-text-2">{t("sample.meta")}</span>
            <span className="font-mono text-xs text-text-3">{TYPE_SCALE.eyebrow}</span>
            <span className="text-xs font-medium tracking-caps text-text-3 uppercase">
              {t("sample.eyebrow")}
            </span>
            <span className="font-mono text-xs text-text-3">{TYPE_SCALE.hero}</span>
            <Amount value={1284300} signed={false} size="hero" />
            <span className="font-mono text-xs text-text-3">{TYPE_SCALE.mono}</span>
            <span className="font-mono text-sm text-text-2">{t("sample.mono")}</span>
          </Card>
        </Section>

        <Section title={t("icons", { count: CATEGORY_ICON_KEYS.length })}>
          <div className="flex flex-wrap gap-2.5">
            {CATEGORY_ICON_KEYS.map((key, index) => (
              <Tile key={key} color={COLOR_TOKENS[index % COLOR_TOKENS.length]} title={key}>
                <CategoryIcon icon={key} />
              </Tile>
            ))}
          </div>
        </Section>
      </main>
    </ToastProvider>
  );
}
