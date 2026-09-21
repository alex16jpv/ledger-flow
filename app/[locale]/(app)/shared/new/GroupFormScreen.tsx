"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { List, Plus, Users, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { Avatar } from "@/components/shell/Avatar";
import { PageHeader } from "@/components/shell/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Field, Input } from "@/components/ui/Field";
import { Picker } from "@/components/ui/Picker";
import { Segment } from "@/components/ui/Segment";
import { SwatchGrid } from "@/components/ui/Swatch";
import { Tile } from "@/components/ui/Tile";
import { useToast } from "@/components/ui/Toast";
import { ContactPickerSheet } from "@/features/shared/components/ContactPickerSheet";
import { useCreateSharedExpense, useCreateSharedGroup } from "@/features/shared/hooks";
import { groupFormSchema, type GroupFormValues } from "@/features/shared/schemas";
import { USER_KEY } from "@/features/shared/split";
import { expenseFromTransaction, groupDefaultSplit } from "@/features/shared/write";
import { ApiError, fieldErrors, presentError } from "@/lib/api/errors";
import { useRouter } from "@/lib/i18n/navigation";
import { useMoney } from "@/lib/i18n/useMoney";
import { validationMessage } from "@/lib/i18n/validation";
import { iconProps } from "@/lib/icons/sizes";
import { useBackNavigation } from "@/lib/navigation/history";
import { randomColorToken } from "@/lib/theme/feature-color";
import type { Contact, Transaction } from "@/types/api";

import { TransactionPickerSheet } from "../TransactionPickerSheet";

export function GroupFormScreen() {
  const t = useTranslations();
  const money = useMoney();
  const router = useRouter();
  const back = useBackNavigation();
  const toast = useToast();
  const createGroup = useCreateSharedGroup();
  const createExpense = useCreateSharedExpense();
  const [suggested] = useState(() => randomColorToken());
  const [people, setPeople] = useState<Contact[]>([]);
  const [percent, setPercent] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<Transaction[]>([]);
  const [sheet, setSheet] = useState<"people" | "transactions" | null>(null);

  const form = useForm<GroupFormValues>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: { name: "", color: suggested, mode: "EQUAL" },
  });
  const { errors } = form.formState;
  const mode = useWatch({ control: form.control, name: "mode" });
  const serverFields = fieldErrors(createGroup.error);
  const duplicate = createGroup.error instanceof ApiError && createGroup.error.code === "DUPLICATE";

  const shares = [null, ...people.map((one) => one.id)];
  const assigned = shares.reduce(
    (sum, id) => sum + (Number.parseFloat(percent[id ?? USER_KEY] ?? "") || 0),
    0,
  );
  const left = 100 - assigned;
  const pickedTotal = picked.reduce((sum, row) => sum + row.amount, 0);

  const submit = form.handleSubmit(async (values) => {
    try {
      const group = await createGroup.mutateAsync({
        name: values.name,
        color: values.color,
        contactIds: people.map((one) => one.id),
        defaultSplit: groupDefaultSplit(values.mode, shares, percent),
      });
      for (const transaction of picked) {
        await createExpense.mutateAsync(expenseFromTransaction(group, transaction));
      }
      toast.show({ message: t("shared.form.groupCreated") });
      router.replace(`/shared/groups/${group.id}`);
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== "DUPLICATE") {
        toast.show({ message: t(presentError(error).messageKey), tone: "danger" });
      }
    }
  });

  const saving = createGroup.isPending || createExpense.isPending;

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
      <PageHeader
        title={t("shared.form.groupTitle")}
        onBack={() => {
          back("/shared");
        }}
      />
      <form
        onSubmit={(event) => {
          void submit(event);
        }}
        noValidate
        className="flex flex-col gap-4"
      >
        <Field
          label={t("shared.form.groupName")}
          error={
            duplicate
              ? t("shared.form.groupDuplicate", { name: form.getValues("name").trim() })
              : validationMessage(t, errors.name?.message ?? serverFields.name)
          }
        >
          <Input
            placeholder={t("shared.form.groupNamePlaceholder")}
            autoComplete="off"
            leading={<Users {...iconProps("sm")} />}
            {...form.register("name")}
          />
        </Field>
        <Controller
          control={form.control}
          name="color"
          render={({ field }) => (
            <Field label={t("shared.form.color")}>
              <SwatchGrid
                value={field.value}
                onChange={field.onChange}
                label={t("shared.form.color")}
              />
            </Field>
          )}
        />
        <Field label={t("shared.form.whoWasIn")} help={t("shared.form.whoWasInHelp")}>
          <div className="flex flex-wrap gap-2">
            <Chip selected disabled>
              <Avatar name={t("shared.group.you")} size="sm" />
              {t("shared.group.you")}
            </Chip>
            {people.map((person) => (
              <Chip
                key={person.id}
                selected
                onClick={() => {
                  setPeople((was) => was.filter((one) => one.id !== person.id));
                }}
              >
                <Avatar name={person.name} color={person.color} size="sm" />
                {person.name}
                <X {...iconProps("sm")} />
              </Chip>
            ))}
            <Chip
              onClick={() => {
                setSheet("people");
              }}
            >
              <Plus {...iconProps("sm")} />
              {t("shared.split.addPerson")}
            </Chip>
          </div>
        </Field>
        <Controller
          control={form.control}
          name="mode"
          render={({ field }) => (
            <Field label={t("shared.form.defaultSplit")} help={t("shared.form.defaultSplitHelp")}>
              <Segment
                label={t("shared.form.defaultSplit")}
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: "EQUAL", label: t("shared.split.modes.EQUAL") },
                  { value: "PERCENT", label: t("shared.split.modes.PERCENT") },
                ]}
              />
            </Field>
          )}
        />
        {mode === "PERCENT" && (
          <div className="flex flex-col gap-2.5">
            {shares.map((id) => {
              const key = id ?? USER_KEY;
              const person = people.find((one) => one.id === id);
              const name = person?.name ?? t("shared.group.you");
              return (
                <div key={key} className="flex items-center gap-3">
                  <Avatar name={name} color={person?.color ?? null} />
                  <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
                  <Input
                    inputMode="decimal"
                    className="h-10 w-[112px] text-right tabular-nums"
                    aria-label={t("shared.split.shareOf", { name })}
                    value={percent[key] ?? ""}
                    onChange={(event) => {
                      setPercent((was) => ({ ...was, [key]: event.target.value }));
                    }}
                  />
                </div>
              );
            })}
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm text-text-3">{t("shared.split.leftToAssign")}</span>
              <span className="font-semibold tabular-nums">{left}%</span>
            </div>
          </div>
        )}
        <Field label={t("shared.form.expenses")}>
          <Picker
            label={t("shared.form.pickFromTransactions")}
            value={
              picked.length === 0
                ? undefined
                : t("shared.form.picked", {
                    count: picked.length,
                    amount: money.format(pickedTotal),
                  })
            }
            placeholder={t("shared.form.pickNone")}
            leading={
              <Tile size="sm" color="GRAY">
                <List {...iconProps("sm")} />
              </Tile>
            }
            onClick={() => {
              setSheet("transactions");
            }}
          />
        </Field>
        {/* Splitting changes nothing today: an expense counts in full until somebody pays you back. */}
        <Alert tone="neutral">{t("shared.form.nothingChanges")}</Alert>
        <Button
          type="submit"
          size="lg"
          block
          loading={saving}
          disabled={mode === "PERCENT" && left !== 0}
        >
          {t("shared.form.createGroup")}
        </Button>
      </form>
      <ContactPickerSheet
        open={sheet === "people"}
        onClose={() => {
          setSheet(null);
        }}
        selected={people.map((one) => one.id)}
        inGroup={1 + people.length}
        onDone={(contacts) => {
          setPeople(contacts);
          setSheet(null);
        }}
      />
      <TransactionPickerSheet
        open={sheet === "transactions"}
        onClose={() => {
          setSheet(null);
        }}
        onDone={(transactions) => {
          setPicked(transactions);
          setSheet(null);
        }}
      />
    </div>
  );
}
