"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { CurrencyPicker } from "@/components/ui/CurrencyPicker";
import { Field, Input } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { TimeZonePicker } from "@/components/ui/TimeZonePicker";
import { presentError } from "@/lib/api/errors";

interface SheetProps {
  open: boolean;
  onClose: () => void;
}

export function CurrencySheet({
  open,
  onClose,
  currency,
  locked,
  pending,
  offline = false,
  error,
  onSave,
}: SheetProps & {
  currency: string;
  locked: boolean;
  pending: boolean;
  offline?: boolean;
  error: unknown;
  onSave: (currency: string) => void;
}) {
  const t = useTranslations();
  const [value, setValue] = useState(currency);
  const failure = error ? presentError(error) : null;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("settings.currency.sheetTitle")}
      footer={
        locked ? (
          <Button variant="ghost" size="lg" block onClick={onClose}>
            {t("common.close")}
          </Button>
        ) : (
          <>
            <Button
              size="lg"
              block
              disabled={value === currency || offline}
              loading={pending}
              onClick={() => {
                onSave(value);
              }}
            >
              {t("common.save")}
            </Button>
            <Button variant="ghost" size="lg" block onClick={onClose}>
              {t("common.cancel")}
            </Button>
          </>
        )
      }
    >
      {locked ? (
        <Alert tone="neutral">{t("settings.currency.lockedBody", { currency })}</Alert>
      ) : (
        <div className="flex flex-col gap-3">
          {offline && <Alert tone="warning">{t("settings.needsConnection")}</Alert>}
          {offline && <Alert tone="warning">{t("settings.needsConnection")}</Alert>}
          {failure && <Alert tone="danger">{t(failure.messageKey)}</Alert>}
          <CurrencyPicker
            value={value}
            onChange={setValue}
            label={t("settings.currency.title")}
            hint={t("settings.currency.pickerHint")}
          />
          <Alert tone="neutral">{t("settings.currency.unlocked")}</Alert>
        </div>
      )}
    </Sheet>
  );
}

export function TimeZoneSheet({
  open,
  onClose,
  timeZone,
  pending,
  offline = false,
  error,
  onSave,
}: SheetProps & {
  timeZone: string;
  pending: boolean;
  error: unknown;
  offline?: boolean;
  onSave: (timeZone: string) => void;
}) {
  const t = useTranslations();
  const [value, setValue] = useState(timeZone);
  const failure = error ? presentError(error) : null;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("settings.timeZone.sheetTitle")}
      footer={
        <>
          <Button
            size="lg"
            block
            disabled={value === timeZone || offline}
            loading={pending}
            onClick={() => {
              onSave(value);
            }}
          >
            {t("common.save")}
          </Button>
          <Button variant="ghost" size="lg" block onClick={onClose}>
            {t("common.cancel")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {failure && <Alert tone="danger">{t(failure.messageKey)}</Alert>}
        <TimeZonePicker
          value={value}
          onChange={setValue}
          label={t("settings.timeZone.title")}
          hint={t("settings.timeZone.pickerHint")}
        />
      </div>
    </Sheet>
  );
}

export function DeleteAccountSheet({
  open,
  onClose,
  pending,
  offline = false,
  error,
  onConfirm,
}: SheetProps & { pending: boolean; offline?: boolean; error: unknown; onConfirm: () => void }) {
  const t = useTranslations();
  const word = t("settings.delete.word");
  const [typed, setTyped] = useState("");
  const failure = error ? presentError(error) : null;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("settings.delete.title")}
      footer={
        <>
          <Button
            variant="dangerSolid"
            size="lg"
            block
            disabled={typed.trim() !== word || offline}
            loading={pending}
            onClick={onConfirm}
          >
            {t("settings.delete.confirm")}
          </Button>
          <Button variant="ghost" size="lg" block onClick={onClose}>
            {t("common.cancel")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Alert tone="danger">{t("settings.delete.body")}</Alert>
        {offline && <Alert tone="warning">{t("settings.needsConnection")}</Alert>}
        {failure && <Alert tone="danger">{t(failure.messageKey)}</Alert>}
        <Field label={t("settings.delete.confirmLabel", { word })}>
          <Input
            value={typed}
            autoComplete="off"
            autoCapitalize="characters"
            placeholder={word}
            onChange={(event) => {
              setTyped(event.target.value);
            }}
          />
        </Field>
      </div>
    </Sheet>
  );
}

// F-34: signing out with a queue behind you is a decision, not a side effect. Keeping is the
// default and the safe answer — the operations go out at the next sign-in on this device.
export function SignOutSheet({
  open,
  onClose,
  pending,
  onKeep,
  onDiscard,
}: SheetProps & { pending: number; onKeep: () => void; onDiscard: () => void }) {
  const t = useTranslations();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("settings.signOutPending.title")}
      footer={
        <>
          <Button size="lg" block onClick={onKeep}>
            {t("settings.signOutPending.keep")}
          </Button>
          <Button variant="dangerSolid" size="lg" block onClick={onDiscard}>
            {t("settings.signOutPending.discard")}
          </Button>
          <Button variant="ghost" size="lg" block onClick={onClose}>
            {t("common.cancel")}
          </Button>
        </>
      }
    >
      <Alert tone="warning">{t("settings.signOutPending.body", { count: pending })}</Alert>
    </Sheet>
  );
}
