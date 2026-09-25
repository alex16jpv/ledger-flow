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
import { SwatchGrid } from "@/components/ui/Swatch";
import { Tile } from "@/components/ui/Tile";
import { useToast } from "@/components/ui/Toast";
import { ContactPickerSheet } from "@/features/shared/components/ContactPickerSheet";
import {
  DefaultSplitFields,
  type DefaultSplitPerson,
  percentIsWhole,
} from "@/features/shared/components/DefaultSplitFields";
import { useCreateSharedExpense, useCreateSharedGroup } from "@/features/shared/hooks";
import { groupFormSchema, type GroupFormValues } from "@/features/shared/schemas";
import { expenseFromTransaction, groupDefaultSplit } from "@/features/shared/write";
import { ApiError, fieldErrors, presentError } from "@/lib/api/errors";
import { useRouter } from "@/lib/i18n/navigation";
import { useMoney } from "@/lib/i18n/useMoney";
import { validationMessage } from "@/lib/i18n/validation";
import { iconProps } from "@/lib/icons/sizes";
import { sumAmounts } from "@/lib/local/derive/money";
import { newEntityId } from "@/lib/local/outbox/envelope";
import { useBackNavigation } from "@/lib/navigation/history";
import { randomColorToken } from "@/lib/theme/feature-color";
import type { Contact, Transaction } from "@/types/api";

import { TransactionPickerSheet } from "../TransactionPickerSheet";
import { WhatChangesSheet } from "../WhatChangesSheet";

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
  const [asked, setAsked] = useState(false);
  // Minted once: a second try must finish the group it started, never open another one.
  const [groupId] = useState(() => newEntityId());

  const form = useForm<GroupFormValues>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: { name: "", color: suggested, mode: "EQUAL" },
  });
  const { errors } = form.formState;
  const mode = useWatch({ control: form.control, name: "mode" });
  const serverFields = fieldErrors(createGroup.error);
  const duplicate = createGroup.error instanceof ApiError && createGroup.error.code === "DUPLICATE";

  const shares = [null, ...people.map((one) => one.id)];
  const splitPeople: DefaultSplitPerson[] = [
    { contactId: null, name: t("shared.group.you"), color: null },
    ...people.map((one) => ({ contactId: one.id, name: one.name, color: one.color ?? null })),
  ];
  const pickedTotal = sumAmounts(picked.map((row) => row.amount));

  function fail(error: unknown) {
    if (!(error instanceof ApiError) || error.code !== "DUPLICATE") {
      toast.show({ message: t(presentError(error).messageKey), tone: "danger" });
    }
  }

  const submit = form.handleSubmit(async (values) => {
    // What it changes in the budgets is said before saving, and only where there is something to say.
    if (picked.length > 0 && !asked) {
      setAsked(true);
      return;
    }
    let group;
    try {
      group = await createGroup.mutateAsync({
        id: groupId,
        name: values.name,
        color: values.color,
        contactIds: people.map((one) => one.id),
        defaultSplit: groupDefaultSplit(values.mode, shares, percent),
      });
    } catch (error) {
      fail(error);
      return;
    }
    // The group exists from here on: whatever an expense does, the form must not offer to make it twice.
    try {
      for (const transaction of picked) {
        await createExpense.mutateAsync(expenseFromTransaction(group, transaction));
      }
      toast.show({ message: t("shared.form.groupCreated") });
    } catch (error) {
      fail(error);
    }
    router.replace(`/shared/groups/${group.id}`);
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
            <DefaultSplitFields
              mode={field.value}
              onMode={field.onChange}
              people={splitPeople}
              percent={percent}
              onPercent={setPercent}
            />
          )}
        />
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
          disabled={!percentIsWhole(mode, splitPeople, percent)}
        >
          {t("shared.form.createGroup")}
        </Button>
      </form>
      {sheet === "people" && (
        <ContactPickerSheet
          open
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
      )}
      {sheet === "transactions" && (
        <TransactionPickerSheet
          open
          selected={picked}
          onClose={() => {
            setSheet(null);
          }}
          onDone={(transactions) => {
            setPicked(transactions);
            setSheet(null);
          }}
        />
      )}
      {asked && (
        <WhatChangesSheet
          open
          onClose={() => {
            setAsked(false);
          }}
          groupName={form.getValues("name")}
          transactions={picked}
          pending={saving}
          onConfirm={() => {
            void submit();
          }}
        />
      )}
    </div>
  );
}
