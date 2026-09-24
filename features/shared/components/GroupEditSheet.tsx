"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Field, Input } from "@/components/ui/Field";
import { Sheet, SheetAction, SheetCancel } from "@/components/ui/Sheet";
import { SwatchGrid } from "@/components/ui/Swatch";
import { useToast } from "@/components/ui/Toast";
import { ApiError, fieldErrors, presentError } from "@/lib/api/errors";
import { formatPlainNumber } from "@/lib/format/money";
import { useMoney } from "@/lib/i18n/useMoney";
import { validationMessage } from "@/lib/i18n/validation";
import type { ColorToken } from "@/lib/theme/feature-color";
import type { DefaultSplit, SyncSharedGroup } from "@/types/api";

import { useUpdateSharedGroup } from "../hooks";
import { GROUP_NAME_MAX } from "../schemas";
import { USER_KEY } from "../split";
import { groupDefaultSplit } from "../write";
import { DefaultSplitFields, type DefaultSplitPerson, percentIsWhole } from "./DefaultSplitFields";

export interface GroupEditSheetProps {
  group: SyncSharedGroup;
  people: DefaultSplitPerson[];
  open: boolean;
  onClose: () => void;
}

const percentOf = (split: DefaultSplit, locale: string): Record<string, string> =>
  Object.fromEntries(
    split.shares.map((share) => [
      share.contactId ?? USER_KEY,
      formatPlainNumber(share.percent, locale),
    ]),
  );

export function GroupEditSheet({ group, people, open, onClose }: GroupEditSheetProps) {
  const t = useTranslations();
  const money = useMoney();
  const toast = useToast();
  const save = useUpdateSharedGroup();
  const [name, setName] = useState(group.name);
  const [color, setColor] = useState<ColorToken | null>(group.color ?? null);
  const [mode, setMode] = useState<DefaultSplit["mode"]>(group.defaultSplit.mode);
  const [percent, setPercent] = useState<Record<string, string>>(() =>
    percentOf(group.defaultSplit, money.locale),
  );
  const serverFields = fieldErrors(save.error);
  const duplicate = save.error instanceof ApiError && save.error.code === "DUPLICATE";
  const trimmed = name.trim();
  const ready = trimmed.length > 0 && percentIsWhole(mode, people, percent);
  const changed =
    trimmed !== group.name ||
    color !== (group.color ?? null) ||
    mode !== group.defaultSplit.mode ||
    JSON.stringify(percent) !== JSON.stringify(percentOf(group.defaultSplit, money.locale));

  async function submit() {
    if (!ready) return;
    try {
      await save.mutateAsync({
        id: group.id,
        name: trimmed,
        color,
        defaultSplit: groupDefaultSplit(
          mode,
          people.map((person) => person.contactId),
          percent,
        ),
      });
      toast.show({ message: t("shared.edit.saved") });
      onClose();
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== "DUPLICATE") {
        toast.show({ message: t(presentError(error).messageKey), tone: "danger" });
      }
    }
  }

  return (
    <Sheet
      layout="full"
      open={open}
      onClose={onClose}
      unsaved={changed}
      title={t("shared.edit.title")}
      footer={
        <>
          <SheetAction
            block
            disabled={!ready}
            loading={save.isPending}
            onClick={() => {
              void submit();
            }}
          >
            {t("common.saveChanges")}
          </SheetAction>
          <SheetCancel />
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          label={t("shared.form.groupName")}
          error={
            duplicate
              ? t("shared.form.groupDuplicate")
              : validationMessage(t, serverFields.name ?? undefined)
          }
        >
          <Input
            value={name}
            autoFocus
            maxLength={GROUP_NAME_MAX}
            placeholder={t("shared.form.groupNamePlaceholder")}
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
        </Field>
        <Field label={t("shared.form.color")}>
          <SwatchGrid
            value={color}
            label={t("shared.form.color")}
            onChange={(next) => {
              setColor(next);
            }}
          />
        </Field>
        <DefaultSplitFields
          mode={mode}
          onMode={setMode}
          people={people}
          percent={percent}
          onPercent={setPercent}
        />
        {/* Changing it is never retroactive: it applies to what you add from now on. */}
        <Alert tone="neutral">{t("shared.edit.splitNotRetroactive")}</Alert>
      </div>
    </Sheet>
  );
}
