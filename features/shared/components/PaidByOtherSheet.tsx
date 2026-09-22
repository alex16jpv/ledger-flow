"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, Receipt } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { Avatar } from "@/components/shell/Avatar";
import { Alert } from "@/components/ui/Alert";
import { AmountInput } from "@/components/ui/AmountInput";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DateField } from "@/components/ui/DateTimeField";
import { Field, Input } from "@/components/ui/Field";
import { Picker } from "@/components/ui/Picker";
import { PickerSheet } from "@/components/ui/PickerSheet";
import { Sheet, SheetCancel, useUnsavedGuard } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { fieldErrors, presentError } from "@/lib/api/errors";
import { dayKey, localNoon } from "@/lib/format/dates";
import { useFormatSettings } from "@/lib/i18n/FormatSettingsProvider";
import { useMoney } from "@/lib/i18n/useMoney";
import { validationMessage } from "@/lib/i18n/validation";
import { iconProps } from "@/lib/icons/sizes";
import { newEntityId } from "@/lib/local/outbox/envelope";
import type { ColorToken } from "@/lib/theme/feature-color";

import { useCreateSharedExpense } from "../hooks";
import { paidByOtherSchema, type PaidByOtherValues } from "../schemas";
import { expensePaidByOther, inheritedSplit, type SplittingGroup } from "../write";

export interface PaidByOtherPerson {
  contactId: string;
  name: string;
  color: ColorToken | null;
}

export interface PaidByOtherSheetProps {
  open: boolean;
  onClose: () => void;
  group: SplittingGroup;
  groupName: string;
  // The other participants: picking yourself is what the two other ways into the group already are.
  people: readonly PaidByOtherPerson[];
}

export function PaidByOtherSheet({
  open,
  onClose,
  group,
  groupName,
  people,
}: PaidByOtherSheetProps) {
  const t = useTranslations();
  const toast = useToast();
  const money = useMoney();
  const { timeZone } = useFormatSettings();
  const create = useCreateSharedExpense();
  const today = dayKey(new Date(), timeZone);
  const [pickingPayer, setPickingPayer] = useState(false);
  // Minted once: a second try after a refusal must finish this line, never add a second one.
  const [id] = useState(() => newEntityId());
  const form = useForm<PaidByOtherValues>({
    resolver: zodResolver(paidByOtherSchema),
    defaultValues: {
      description: "",
      date: today,
      amount: Number.NaN,
      paidByContactId: people.length === 1 ? (people[0]?.contactId ?? "") : "",
    },
  });
  const { errors, isDirty } = form.formState;
  useUnsavedGuard(isDirty);
  const serverFields = fieldErrors(create.error);
  const failure =
    create.error && Object.keys(serverFields).length === 0 ? presentError(create.error) : null;
  const [amount, payerId] = useWatch({
    control: form.control,
    name: ["amount", "paidByContactId"],
  });
  const payer = people.find((person) => person.contactId === payerId);
  const payerError = validationMessage(
    t,
    errors.paidByContactId?.message ?? serverFields.paidByContactId,
  );
  const payerHelpId = `${useId()}-who-paid`;
  const payerErrorId = `${payerHelpId}-error`;
  const share =
    Number.isFinite(amount) && amount > 0
      ? (inheritedSplit(group, amount, payerId || null).shares.find((one) => one.party === "USER")
          ?.amount ?? 0)
      : 0;

  const submit = form.handleSubmit(async (values) => {
    try {
      await create.mutateAsync(
        expensePaidByOther(
          group,
          {
            description: values.description,
            date: localNoon(values.date, timeZone).toISOString(),
            amount: values.amount,
            paidByContactId: values.paidByContactId,
          },
          id,
        ),
      );
      form.reset(values);
      onClose();
      toast.show({ message: t("shared.paidByOther.added") });
    } catch {
      return;
    }
  });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      unsaved={isDirty}
      title={t("shared.paidByOther.title")}
      footer={
        <>
          <Button
            size="lg"
            block
            loading={create.isPending}
            onClick={() => {
              void submit();
            }}
          >
            {t("shared.paidByOther.add")}
          </Button>
          <SheetCancel />
        </>
      }
    >
      <form
        onSubmit={(event) => {
          void submit(event);
        }}
        noValidate
        className="flex flex-col gap-3"
      >
        <Field
          label={t("shared.paidByOther.description")}
          error={validationMessage(t, errors.description?.message ?? serverFields.description)}
        >
          <Input
            placeholder={t("shared.paidByOther.descriptionPlaceholder")}
            autoComplete="off"
            leading={<Receipt {...iconProps("sm")} />}
            {...form.register("description")}
          />
        </Field>
        <Controller
          control={form.control}
          name="date"
          render={({ field }) => (
            <DateField
              value={field.value}
              onChange={field.onChange}
              label={t("common.date")}
              max={today}
              note={t("shared.paidByOther.dateNote")}
              error={validationMessage(t, errors.date?.message ?? serverFields.date)}
            />
          )}
        />
        <Controller
          control={form.control}
          name="amount"
          render={({ field }) => (
            <Field
              label={t("transactions.form.amount")}
              error={validationMessage(t, errors.amount?.message ?? serverFields.amount)}
            >
              <Card className="p-0">
                <AmountInput
                  size="sm"
                  label={t("transactions.form.amount")}
                  defaultValue={Number.isFinite(field.value) ? field.value : null}
                  onChange={(value) => {
                    field.onChange(value ?? Number.NaN);
                  }}
                  className="py-4"
                />
              </Card>
            </Field>
          )}
        />
        <div className="flex flex-col gap-1.5">
          <Picker
            aria-describedby={payerError ? `${payerHelpId} ${payerErrorId}` : payerHelpId}
            label={t("shared.paidByOther.whoPaid")}
            placeholder={t("shared.paidByOther.whoPaidPlaceholder")}
            value={payer?.name}
            leading={payer && <Avatar name={payer.name} color={payer.color} />}
            className={payerError ? "border-danger-solid" : undefined}
            onClick={() => {
              setPickingPayer(true);
            }}
          />
          <span id={payerHelpId} className="text-sm text-text-3">
            {t("shared.paidByOther.whoPaidHelp")}
          </span>
          {payerError && (
            <span
              id={payerErrorId}
              role="alert"
              className="flex items-center gap-1 text-sm text-danger"
            >
              <CircleAlert {...iconProps("sm")} />
              {payerError}
            </span>
          )}
        </div>
        <Alert tone="neutral">
          {t(`shared.paidByOther.inherits.${group.defaultSplit.mode}`, {
            people: group.participants.length,
            share: money.format(share),
          })}
        </Alert>
        <Alert tone="info">
          {payer
            ? t("shared.paidByOther.nothingOfYoursNamed", { name: payer.name })
            : t("shared.paidByOther.nothingOfYours")}
        </Alert>
        {failure && <p className="text-sm text-danger">{t(failure.messageKey)}</p>}
      </form>
      {pickingPayer && (
        <PickerSheet
          open
          onClose={() => {
            setPickingPayer(false);
          }}
          title={t("shared.paidByOther.whoPaidTitle", { name: groupName })}
          options={people.map((person) => ({
            value: person.contactId,
            label: person.name,
            leading: <Avatar name={person.name} color={person.color} />,
          }))}
          value={payerId || null}
          onSelect={(value) => {
            form.setValue("paidByContactId", value, { shouldDirty: true, shouldValidate: true });
          }}
        />
      )}
    </Sheet>
  );
}
