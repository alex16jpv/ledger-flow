"use client";

import { Briefcase, Coffee, Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";

import { PageHeader } from "@/components/shell/PageHeader";
import { Amount } from "@/components/ui/Amount";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { List, Row, RowBody, RowMeta, RowRight, RowTitle } from "@/components/ui/Row";
import { Segment } from "@/components/ui/Segment";
import { Tile } from "@/components/ui/Tile";
import { useRouter } from "@/lib/i18n/navigation";
import { iconProps } from "@/lib/icons/sizes";
import { MODES, PALETTES, useTheme } from "@/lib/theme";

import { PaletteCard } from "./PaletteCard";

const MODE_ICONS = { light: Sun, dark: Moon, system: Monitor } as const;

export function AppearanceView() {
  const t = useTranslations();
  const theme = useTheme();
  const router = useRouter();

  return (
    <>
      <PageHeader
        title={t("settings.appearance.title")}
        onBack={() => {
          router.push("/settings");
        }}
      />
      <Field label={t("settings.appearance.mode")}>
        <Segment
          label={t("settings.appearance.mode")}
          value={theme.mode}
          onChange={theme.setMode}
          options={MODES.map((mode) => {
            const Icon = MODE_ICONS[mode];
            return {
              value: mode,
              label: t(`settings.appearance.${mode}`),
              icon: <Icon {...iconProps("sm")} />,
            };
          })}
        />
      </Field>
      <Field label={t("settings.appearance.palette")} help={t("settings.appearance.note")}>
        <div className="grid grid-cols-2 gap-3">
          {PALETTES.map((palette) => (
            <PaletteCard
              key={palette}
              palette={palette}
              name={t(`settings.appearance.palettes.${palette}.name`)}
              description={t(`settings.appearance.palettes.${palette}.description`)}
              selected={theme.palette === palette}
              onSelect={theme.setPalette}
            />
          ))}
        </div>
      </Field>
      <Card className="flex flex-col gap-3">
        <span className="text-xs font-medium tracking-caps text-text-3 uppercase">
          {t("settings.appearance.preview")}
        </span>
        <List className="-mx-4">
          <Row>
            <Tile color="BROWN">
              <Coffee {...iconProps("md")} />
            </Tile>
            <RowBody>
              <RowTitle>
                <span>{t("dev.sample.coffee")}</span>
              </RowTitle>
              <RowMeta items={[t("common.today"), t("dev.sample.cash")]} />
            </RowBody>
            <RowRight>
              <Amount value={9800} />
            </RowRight>
          </Row>
          <Row>
            <Tile color="GREEN">
              <Briefcase {...iconProps("md")} />
            </Tile>
            <RowBody>
              <RowTitle>
                <span>{t("dev.sample.salary")}</span>
              </RowTitle>
              <RowMeta items={[t("common.yesterday"), t("dev.sample.bank")]} />
            </RowBody>
            <RowRight>
              <Amount value={4200000} kind="income" />
            </RowRight>
          </Row>
        </List>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm">{t("dev.sample.primary")}</Button>
          <Button size="sm" variant="secondary">
            {t("dev.sample.secondary")}
          </Button>
          <Badge tone="warning">{t("dev.sample.toReview")}</Badge>
          <Badge tone="success">{t("dev.sample.onTrack")}</Badge>
        </div>
      </Card>
    </>
  );
}
