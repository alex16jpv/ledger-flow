"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { Alert } from "@/components/ui/Alert";
import { Amount } from "@/components/ui/Amount";
import { Button } from "@/components/ui/Button";
import { DateTimeField, type DateTimeValue } from "@/components/ui/DateTimeField";
import { Field, Input } from "@/components/ui/Field";
import { Sheet, SheetAction, SheetCancel } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { dateTimeInstant, dateTimeParts } from "@/lib/format/dates";
import { useFormatSettings } from "@/lib/i18n/FormatSettingsProvider";
import { useDates } from "@/lib/i18n/useDates";
import { aheadOfServer, clockStore, serverNow } from "@/lib/local/clock";
import {
  type ConflictField,
  conflictFields,
  isFutureDate,
  isNameTaken,
  ownServerRow,
} from "@/lib/local/outbox/conflict";
import { operationPayload } from "@/lib/local/outbox/envelope";
import {
  discardImpact,
  discardOperation,
  restoreArchivedAccount,
  restoreWithName,
  retryOperation,
  retryWithDate,
} from "@/lib/local/outbox/resolve";
import { useOutbox } from "@/lib/local/outbox/useOutbox";
import { currentVault } from "@/lib/local/repository/read";
import type { OutboxOperation } from "@/lib/local/schema";
import { reportError } from "@/lib/observability/reporter";

type Names = ReadonlyMap<string, string>;

interface Loaded {
  operation: OutboxOperation;
  fields: ConflictField[];
  names: Names;
  // §8.12 I7: a refused creation holds back everything queued on top of it, minus itself.
  waiting: number;
}

type View = { kind: "loading" } | { kind: "empty" } | ({ kind: "resolve" } & Loaded);

const MONEY_FIELDS = new Set(["amount", "balance", "openingBalance"]);
const DATE_FIELDS = new Set([
  "date",
  "effectiveFrom",
  "periodStartDate",
  "periodEndDate",
  "archivedAt",
]);
const REFERENCE_FIELDS = new Set(["categoryId", "categoryIds", "fromAccountId", "toAccountId"]);

// Declared here, not imported from a feature: this sheet sits below them and serves both.
const NAME_MAX = 255;

async function load(seq: number): Promise<View> {
  const vault = currentVault();
  if (!vault) return { kind: "empty" };
  const operation = await vault.db.get("outbox", seq);
  if (!operation || (operation.status !== "conflict" && operation.status !== "failed")) {
    return { kind: "empty" };
  }
  // The mirror holds every account, category and person: a sheet printing raw ids would be useless.
  const names = new Map<string, string>();
  for (const record of await vault.db.getAll("accounts")) names.set(record.id, record.row.name);
  for (const record of await vault.db.getAll("categories")) names.set(record.id, record.row.name);
  for (const record of await vault.db.getAll("contacts")) names.set(record.id, record.row.name);
  return {
    kind: "resolve",
    operation,
    fields: conflictFields(operation, operation.serverRow),
    names,
    waiting: Math.max(0, (await discardImpact(vault.db, [seq])) - 1),
  };
}

export interface SyncConflictSheetProps {
  open: boolean;
  // The operation to resolve, in queue order. Null while nothing needs a decision.
  seq: number | null;
  onClose: () => void;
}

// F-58: the way out is an `account:restore` queued ahead of it, travelling in the same batch.
const isArchivedAccount = (operation: OutboxOperation): boolean =>
  operation.status === "conflict" && operation.lastError === "RESOURCE_ARCHIVED";

export function SyncConflictSheet({ open, seq, onClose }: SyncConflictSheetProps) {
  const t = useTranslations("states.conflict");
  const common = useTranslations("common");
  const toast = useToast();
  const dates = useDates();
  const { timeZone } = useFormatSettings();
  const outbox = useOutbox();
  const [loaded, setLoaded] = useState<{ seq: number; view: View } | null>(null);
  const [busy, setBusy] = useState(false);
  // F-60: the typed name is tagged with its operation — another operation is another question.
  const [renamed, setRenamed] = useState<{ seq: number; name: string } | null>(null);
  const renameTo = renamed?.seq === seq ? renamed.name : null;
  // The date the user is correcting (F-66), tagged with its operation for the same reason.
  const [corrected, setCorrected] = useState<{ seq: number; value: DateTimeValue } | null>(null);
  const correctedTo = corrected?.seq === seq ? corrected.value : null;
  const offset = useSyncExternalStore(
    clockStore.subscribe,
    clockStore.getSnapshot,
    clockStore.getServerSnapshot,
  );

  useEffect(() => {
    if (!open || seq === null) return;
    let live = true;
    void load(seq)
      // The mirror can be closed or wiped mid-read — logout, another tab — and then there is nothing left to resolve.
      .catch((error: unknown): View => {
        reportError(error, "vault");
        return { kind: "empty" };
      })
      .then((next) => {
        if (live) setLoaded({ seq, view: next });
      });
    return () => {
      live = false;
    };
    // The queue is the source: a drain that resolved this while the sheet was open has to move it.
  }, [open, seq, outbox.attention]);

  const view: View = loaded?.seq === seq ? loaded.view : { kind: "loading" };

  const resolve = useCallback(
    async (
      action: (db: NonNullable<ReturnType<typeof currentVault>>["db"]) => Promise<unknown>,
    ) => {
      const vault = currentVault();
      if (!vault) return;
      setBusy(true);
      try {
        await action(vault.db);
      } finally {
        setBusy(false);
      }
      onClose();
    },
    [onClose],
  );

  const moment = (iso: string): string => {
    const at = new Date(iso);
    return [dates.formatDay(at), dates.formatTime(at)].join(" ");
  };

  const plain = (raw: unknown): string =>
    typeof raw === "string" ? raw : typeof raw === "number" ? raw.toString() : JSON.stringify(raw);

  function value(field: string, raw: unknown, names: Names) {
    if (raw === null || raw === undefined || raw === "") return <span>{t("none")}</span>;
    if (MONEY_FIELDS.has(field) && typeof raw === "number") return <Amount value={raw} size="sm" />;
    if (DATE_FIELDS.has(field) && typeof raw === "string") return <span>{moment(raw)}</span>;
    if (typeof raw === "boolean") return <span>{t(raw ? "yes" : "no")}</span>;
    if (Array.isArray(raw)) {
      if (raw.length === 0) return <span>{t("none")}</span>;
      const parts: string[] = raw.map((item: unknown) =>
        REFERENCE_FIELDS.has(field) && typeof item === "string"
          ? (names.get(item) ?? item)
          : plain(item),
      );
      return <span>{parts.join(", ")}</span>;
    }
    if (REFERENCE_FIELDS.has(field) && typeof raw === "string") {
      return <span>{names.get(raw) ?? raw}</span>;
    }
    return <span>{plain(raw)}</span>;
  }

  function card(title: string, side: "mine" | "theirs", loaded: Loaded, only?: ConflictField[]) {
    const fields = only ?? loaded.fields;
    return (
      <section className="flex flex-col gap-2 rounded-md border border-border bg-surface-2 p-3">
        <h3 className="text-xs font-semibold text-text-2 uppercase">{title}</h3>
        <dl className="flex flex-col gap-1.5 text-sm">
          {fields.map((field) => (
            <div
              key={field.name}
              className={
                field.disputed
                  ? "flex items-baseline justify-between gap-3 rounded-sm bg-warning-soft px-1.5 py-0.5 text-warning"
                  : "flex items-baseline justify-between gap-3 px-1.5 py-0.5"
              }
            >
              <dt className="shrink-0 text-text-2">{label(field.name)}</dt>
              <dd className="min-w-0 text-right font-medium break-words">
                {value(field.name, field[side], loaded.names)}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    );
  }

  // next-intl types keys against the message tree; `t.has` guards the cast this costs.
  type MessageKey = Parameters<typeof t>[0];
  const optional = (key: string, values?: Record<string, string>): string | null => {
    const typed = key as MessageKey;
    return t.has(typed) ? t(typed, values) : null;
  };

  function label(field: string): string {
    return optional(`fields.${field}`) ?? field;
  }

  // F-60: the restore carries no fields, so the comparison uses the server's row, somebody else's.
  const takenName = (loaded: Loaded): string =>
    (loaded.operation.serverRow as { name?: unknown } | null | undefined)?.name as string;
  const restoredName = (loaded: Loaded): string =>
    loaded.names.get(loaded.operation.entityId) ?? "";
  const nameComparison = (loaded: Loaded): ConflictField[] => [
    { name: "name", mine: restoredName(loaded), theirs: takenName(loaded), disputed: true },
  ];
  const suggestedName = (loaded: Loaded): string =>
    t("nameTaken.suggestion", { name: restoredName(loaded) });

  // The date the movement carries, and the one the server would accept: its own clock (F-66).
  const refusedDate = (loaded: Loaded): string | null => {
    const date = (operationPayload(loaded.operation).body as { date?: unknown } | undefined)?.date;
    return typeof date === "string" ? date : null;
  };
  const serverInstant = (): Date => new Date(serverNow());
  const skewLine = (): string | null => {
    const skew = aheadOfServer(offset);
    if (!skew) return null;
    return skew.unit === "days"
      ? t("futureDate.skewDays", { count: skew.count })
      : t("futureDate.skewHours", { count: skew.count });
  };

  function body() {
    if (view.kind === "loading") return <p className="text-sm text-text-2">{t("loading")}</p>;
    if (view.kind === "empty") {
      return (
        <Alert tone="success" title={t("empty.title")}>
          {t("empty.body")}
        </Alert>
      );
    }
    const { operation, fields } = view;
    const what = t(`entities.${operation.entity}`);
    if (isFutureDate(operation)) {
      const was = refusedDate(view);
      const server = serverInstant();
      const value = correctedTo ?? dateTimeParts(server, timeZone);
      return (
        <div className="flex flex-col gap-3">
          <Alert tone="danger" title={t("futureDate.alert")}>
            {t("futureDate.body", {
              date: was ? moment(was) : t("none"),
              serverDate: moment(server.toISOString()),
            })}
            {skewLine() && ` ${skewLine() ?? ""}`}
          </Alert>
          {fields.length > 0 && card(t("device"), "mine", view)}
          <DateTimeField
            value={value}
            onChange={(next) => {
              setCorrected({ seq: operation.seq, value: next });
            }}
            dateLabel={t("fields.date")}
            timeLabel={common("time")}
          />
          {was && (
            <p className="text-sm text-text-3">{t("futureDate.was", { date: moment(was) })}</p>
          )}
          {view.waiting > 0 && (
            <p className="text-sm text-text-3">
              {t("futureDate.waiting", { count: view.waiting })}
            </p>
          )}
        </div>
      );
    }
    if (isNameTaken(operation)) {
      const comparison = nameComparison(view);
      const typed = renameTo ?? suggestedName(view);
      return (
        <div className="flex flex-col gap-3">
          <Alert tone="danger" title={t("nameTaken.title")}>
            {t("nameTaken.body", { what, name: takenName(view) })}
          </Alert>
          {card(t("nameTaken.server"), "theirs", view, comparison)}
          {card(t("nameTaken.device"), "mine", view, comparison)}
          <Field label={t("nameTaken.name")} help={t("nameTaken.help")}>
            <Input
              value={typed}
              maxLength={NAME_MAX}
              autoComplete="off"
              onChange={(event) => {
                setRenamed({ seq: operation.seq, name: event.target.value });
              }}
            />
          </Field>
          <p className="text-sm text-text-3">{t("nameTaken.noRetry")}</p>
        </div>
      );
    }
    if (isArchivedAccount(operation)) {
      const name = operation.archivedId ? view.names.get(operation.archivedId) : undefined;
      return (
        <div className="flex flex-col gap-3">
          <Alert tone="danger" title={t("archived.title")}>
            {t("archived.body", { what })}
          </Alert>
          {name !== undefined && <p className="text-sm text-text-2">{name}</p>}
          {fields.length > 0 && card(t("device"), "mine", view)}
        </div>
      );
    }
    // Only `STALE_UPDATE` is the same row written twice; any other code is the server's reason.
    if (operation.status === "failed" || operation.lastError !== "STALE_UPDATE") {
      return (
        <div className="flex flex-col gap-3">
          <Alert tone="danger" title={t("failed.title")}>
            {t("failed.body", { reason: operation.lastError ?? t("failed.unknown"), what })}
          </Alert>
          {ownServerRow(operation) !== undefined && card(t("server"), "theirs", view)}
          {fields.length > 0 && card(t("device"), "mine", view)}
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-3">
        <Alert tone="danger" title={t("stale.title")}>
          {t("stale.body", { what })}
        </Alert>
        {fields.length === 0 && (
          <p className="text-sm text-text-2">{optional(`actions.${operation.action}`, { what })}</p>
        )}
        {operation.serverRow === undefined ? (
          <Alert tone="warning">{t("noServerRow")}</Alert>
        ) : (
          fields.length > 0 && card(t("server"), "theirs", view)
        )}
        {fields.length > 0 && card(t("device"), "mine", view)}
      </div>
    );
  }

  // What was typed is only worth a question while the field that holds it is still on screen.
  function stillSendable(): boolean {
    if (view.kind === "empty") return false;
    if (view.kind === "loading") return renameTo !== null || correctedTo !== null;
    return (
      (isNameTaken(view.operation) && renameTo !== null) ||
      (isFutureDate(view.operation) && correctedTo !== null)
    );
  }

  // Only the refused date renames the sheet: it stopped being a comparison and became a correction.
  function sheetTitle(): string {
    return view.kind === "resolve" && isFutureDate(view.operation)
      ? t("futureDate.title")
      : t("title");
  }

  function footer() {
    if (view.kind !== "resolve") {
      return <SheetCancel variant="secondary">{common("close")}</SheetCancel>;
    }
    const { operation } = view;
    // A refusal for good repeats, so discarding leads and Try again is the second chance.
    const discardFirst = operation.status === "failed";
    const onDiscard = () => void resolve((db) => discardOperation(db, operation.seq));
    const onRetry = () => void resolve((db) => retryOperation(db, operation.seq));
    const discard = (
      <Button
        size="lg"
        block
        variant={discardFirst ? "dangerSolid" : "ghost"}
        disabled={busy}
        onClick={onDiscard}
      >
        {discardFirst ? t("discard") : t("keepServer")}
      </Button>
    );
    // A creation the server never took cannot be edited from the list, so it is corrected here.
    if (isFutureDate(operation)) {
      const value = correctedTo ?? dateTimeParts(serverInstant(), timeZone);
      return (
        <>
          <SheetAction
            block
            disabled={busy}
            onClick={() =>
              void resolve((db) =>
                retryWithDate(
                  db,
                  operation.seq,
                  dateTimeInstant(value, timeZone, serverInstant()).toISOString(),
                ),
              )
            }
          >
            {t("futureDate.save")}
          </SheetAction>
          {discard}
        </>
      );
    }
    // The same name would be refused again, so Try again is not offered.
    if (isNameTaken(operation)) {
      const typed = (renameTo ?? suggestedName(view)).trim();
      return (
        <>
          <SheetAction
            block
            disabled={busy || typed === ""}
            onClick={() => void resolve((db) => restoreWithName(db, operation.seq, typed))}
          >
            {t("nameTaken.confirm", { name: typed })}
          </SheetAction>
          {discard}
        </>
      );
    }
    // What unblocks this is restoring the account; moving the movement is an ordinary edit.
    if (isArchivedAccount(operation)) {
      return (
        <>
          <SheetAction
            block
            disabled={busy}
            onClick={() =>
              void resolve(async (db) => {
                if (!(await restoreArchivedAccount(db, operation.seq))) {
                  toast.show({ message: t("archived.gone"), tone: "danger" });
                }
              })
            }
          >
            {t("archived.restore")}
          </SheetAction>
          {discard}
        </>
      );
    }
    return discardFirst ? (
      <>
        <SheetAction block variant="dangerSolid" disabled={busy} onClick={onDiscard}>
          {t("discard")}
        </SheetAction>
        <Button size="lg" block variant="secondary" disabled={busy} onClick={onRetry}>
          {t("retry")}
        </Button>
      </>
    ) : (
      <>
        <SheetAction block disabled={busy} onClick={onRetry}>
          {t("keepMine")}
        </SheetAction>
        {discard}
      </>
    );
  }

  return (
    <Sheet
      layout="full"
      open={open}
      onClose={onClose}
      unsaved={stillSendable()}
      title={sheetTitle()}
      footer={footer()}
    >
      {body()}
    </Sheet>
  );
}
