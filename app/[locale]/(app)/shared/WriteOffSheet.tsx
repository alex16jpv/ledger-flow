"use client";

import { useTranslations } from "next-intl";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Sheet, SheetCancel } from "@/components/ui/Sheet";
import type { GroupView, PartyView } from "@/features/shared/ledger";
import { useMoney } from "@/lib/i18n/useMoney";
import { fromCents, toCents } from "@/lib/local/derive/money";

export interface WriteOffSheetProps {
  view: GroupView;
  person: PartyView;
  open: boolean;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function WriteOffSheet({
  view,
  person,
  open,
  pending,
  onConfirm,
  onClose,
}: WriteOffSheetProps) {
  const t = useTranslations("shared.writeOff");
  const money = useMoney();
  const left = view.people
    .filter((one) => one.key !== person.key)
    .reduce((cents, one) => cents + Math.max(0, toCents(one.owesYou) - toCents(one.youOwe)), 0);
  return (
    <Sheet
      layout="dialog"
      open={open}
      onClose={onClose}
      title={t("title", { name: person.name, amount: money.format(person.owesYou) })}
      footer={
        <>
          <Button size="lg" block variant="dangerSolid" loading={pending} onClick={onConfirm}>
            {t("confirm", { amount: money.format(person.owesYou) })}
          </Button>
          <SheetCancel />
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Alert tone="neutral" title={t("noFigureMoves")}>
          {t("body")}
        </Alert>
        <p className="text-sm text-text-3">
          {person.paid > 0
            ? t("keepsWhatWasPaid", { name: person.name, amount: money.format(person.paid) })
            : t("rowReadsWrittenOff", { name: person.name })}{" "}
          {left <= 0 && view.youOwe <= 0
            ? t("becomesSettled", { name: view.group.name })
            : t("stillOwed", { amount: money.format(fromCents(left)) })}{" "}
          {t("undoable")}
        </p>
      </div>
    </Sheet>
  );
}

export interface ArchiveGroupSheetProps {
  view: GroupView;
  open: boolean;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ArchiveGroupSheet({
  view,
  open,
  pending,
  onConfirm,
  onClose,
}: ArchiveGroupSheetProps) {
  const t = useTranslations("shared.archiveGroup");
  const money = useMoney();
  return (
    <Sheet
      layout="dialog"
      open={open}
      onClose={onClose}
      title={t("title", { name: view.group.name })}
      footer={
        <>
          <Button size="lg" block variant="dangerSolid" loading={pending} onClick={onConfirm}>
            {view.owed > 0
              ? t("confirmWithWriteOff", { amount: money.format(view.owed) })
              : t("confirm")}
          </Button>
          <SheetCancel />
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {view.owed > 0 && (
          <Alert tone="warning" title={t("stillOwed", { amount: money.format(view.owed) })}>
            {t("writesItOff")}
          </Alert>
        )}
        <p className="text-sm text-text-3">{t("body")}</p>
      </div>
    </Sheet>
  );
}

export interface UndoWriteOffSheetProps {
  person: PartyView;
  amount: number;
  open: boolean;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function UndoWriteOffSheet({
  person,
  amount,
  open,
  pending,
  onConfirm,
  onClose,
}: UndoWriteOffSheetProps) {
  const t = useTranslations("shared.writeOff");
  const money = useMoney();
  return (
    <Sheet
      layout="dialog"
      open={open}
      onClose={onClose}
      title={t("undoTitle", { name: person.name })}
      footer={
        <>
          <Button size="lg" block loading={pending} onClick={onConfirm}>
            {t("undoConfirm", { amount: money.format(amount) })}
          </Button>
          <SheetCancel />
        </>
      }
    >
      <p className="text-sm text-text-3">
        {t("undoBody", { name: person.name, amount: money.format(amount) })}
      </p>
    </Sheet>
  );
}
