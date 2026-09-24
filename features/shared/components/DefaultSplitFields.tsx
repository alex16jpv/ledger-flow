"use client";

import { useTranslations } from "next-intl";

import { Avatar } from "@/components/shell/Avatar";
import { Field, Input } from "@/components/ui/Field";
import { Segment } from "@/components/ui/Segment";
import type { ColorToken } from "@/lib/theme/feature-color";
import type { DefaultSplit } from "@/types/api";

import { parsePercent, PERCENT_SCALE, percentLeft, USER_KEY } from "../split";

export interface DefaultSplitPerson {
  contactId: string | null;
  name: string;
  color: ColorToken | null;
}

// The server adds these as basis points, and so does the sheet: in floats three thirds miss 100.
const leftOf = (people: DefaultSplitPerson[], percent: Record<string, string>): number =>
  percentLeft(people.map((person) => parsePercent(percent[person.contactId ?? USER_KEY] ?? "")));

export interface DefaultSplitFieldsProps {
  mode: DefaultSplit["mode"];
  onMode: (mode: DefaultSplit["mode"]) => void;
  people: DefaultSplitPerson[];
  percent: Record<string, string>;
  onPercent: (percent: Record<string, string>) => void;
}

// A default has no total to divide, so it is a smaller control than an expense's, not that one
// with the rows removed: `Equal` and `Percent` are the two that mean something without a total.
export function DefaultSplitFields({
  mode,
  onMode,
  people,
  percent,
  onPercent,
}: DefaultSplitFieldsProps) {
  const t = useTranslations();
  const left = leftOf(people, percent);

  return (
    <>
      <Field label={t("shared.form.defaultSplit")} help={t("shared.form.defaultSplitHelp")}>
        <Segment
          label={t("shared.form.defaultSplit")}
          value={mode}
          onChange={onMode}
          options={[
            { value: "EQUAL", label: t("shared.split.modes.EQUAL") },
            { value: "PERCENT", label: t("shared.split.modes.PERCENT") },
          ]}
        />
      </Field>
      {mode === "PERCENT" && (
        <div className="flex flex-col gap-2.5">
          {people.map((person) => {
            const key = person.contactId ?? USER_KEY;
            return (
              <div key={key} className="flex items-center gap-3">
                <Avatar name={person.name} color={person.color} />
                <span className="min-w-0 flex-1 truncate font-medium">{person.name}</span>
                <span className="w-[112px] shrink-0">
                  <Input
                    inputMode="decimal"
                    className="h-10 text-right tabular-nums"
                    aria-label={t("shared.split.shareOf", { name: person.name })}
                    value={percent[key] ?? ""}
                    onChange={(event) => {
                      onPercent({ ...percent, [key]: event.target.value });
                    }}
                  />
                </span>
              </div>
            );
          })}
          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="text-sm text-text-3">{t("shared.split.leftToAssign")}</span>
            <span className="font-semibold tabular-nums">
              {t("shared.form.percentLeft", { percent: left / PERCENT_SCALE })}
            </span>
          </div>
        </div>
      )}
    </>
  );
}

export const percentIsWhole = (
  mode: DefaultSplit["mode"],
  people: DefaultSplitPerson[],
  percent: Record<string, string>,
): boolean => mode === "EQUAL" || leftOf(people, percent) === 0;
