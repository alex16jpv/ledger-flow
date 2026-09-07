"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Amount } from "@/components/ui/Amount";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { useDates } from "@/lib/i18n/useDates";
import {
  type ConflictField,
  conflictFields,
  isNameTaken,
  ownServerRow,
} from "@/lib/local/outbox/conflict";
import {
  discardOperation,
  restoreArchivedAccount,
  restoreWithName,
  retryOperation,
} from "@/lib/local/outbox/resolve";
import { useOutbox } from "@/lib/local/outbox/useOutbox";
import { currentVault } from "@/lib/local/repository/read";
import type { OutboxOperation } from "@/lib/local/schema";

type Names = ReadonlyMap<string, string>;

interface Loaded {
  operation: OutboxOperation;
  fields: ConflictField[];
  names: Names;
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

// What the API takes for an account's or a category's name. Declared here rather than imported from
// a feature: this sheet sits below them and serves both.
const NAME_MAX = 255;

async function load(seq: number): Promise<View> {
  const vault = currentVault();
  if (!vault) return { kind: "empty" };
  const operation = await vault.db.get("outbox", seq);
  if (!operation || (operation.status !== "conflict" && operation.status !== "failed")) {
    return { kind: "empty" };
  }
  // The mirror already holds every account and category this device knows: a conflict sheet that
  // printed raw ids would be honest and useless.
  const names = new Map<string, string>();
  for (const record of await vault.db.getAll("accounts")) names.set(record.id, record.row.name);
  for (const record of await vault.db.getAll("categories")) names.set(record.id, record.row.name);
  return {
    kind: "resolve",
    operation,
    fields: conflictFields(operation, operation.serverRow),
    names,
  };
}

export interface SyncConflictSheetProps {
  open: boolean;
  // The operation to resolve, in queue order. Null while nothing needs a decision.
  seq: number | null;
  onClose: () => void;
}

// F-58: the account this movement names was archived online. The way out is an operation like any
// other — an `account:restore` queued ahead of it — so both travel in the same batch.
const isArchivedAccount = (operation: OutboxOperation): boolean =>
  operation.status === "conflict" && operation.lastError === "RESOURCE_ARCHIVED";

export function SyncConflictSheet({ open, seq, onClose }: SyncConflictSheetProps) {
  const t = useTranslations("states.conflict");
  const common = useTranslations("common");
  const toast = useToast();
  const dates = useDates();
  const outbox = useOutbox();
  const [loaded, setLoaded] = useState<{ seq: number; view: View } | null>(null);
  const [busy, setBusy] = useState(false);
  // The name the user typed into the embedded rename of F-60, tagged with the operation it was
  // typed for: another operation is another question, and the suggestion is what answers it until
  // someone types over it.
  const [renamed, setRenamed] = useState<{ seq: number; name: string } | null>(null);
  const renameTo = renamed?.seq === seq ? renamed.name : null;

  useEffect(() => {
    if (!open || seq === null) return;
    let live = true;
    void load(seq).then((next) => {
      if (live) setLoaded({ seq, view: next });
    });
    return () => {
      live = false;
    };
    // The queue is the source: a drain that resolved this operation while the sheet was open has to
    // move it to the "nothing left" state rather than leave a decision that no longer exists.
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

  // next-intl types a key against the message tree, and these keys are a field name or an action
  // read off the envelope. `t.has` is the guard; the cast is the one this indirection costs.
  type MessageKey = Parameters<typeof t>[0];
  const optional = (key: string, values?: Record<string, string>): string | null => {
    const typed = key as MessageKey;
    return t.has(typed) ? t(typed, values) : null;
  };

  function label(field: string): string {
    return optional(`fields.${field}`) ?? field;
  }

  // The two names side by side (F-60). The restore's body carries no fields of its own, so the
  // comparison is built from the row this device is putting back and the row the server answered
  // with — which is somebody else's, and the reason the restore was refused.
  const takenName = (loaded: Loaded): string =>
    (loaded.operation.serverRow as { name?: unknown } | null | undefined)?.name as string;
  const restoredName = (loaded: Loaded): string =>
    loaded.names.get(loaded.operation.entityId) ?? "";
  const nameComparison = (loaded: Loaded): ConflictField[] => [
    { name: "name", mine: restoredName(loaded), theirs: takenName(loaded), disputed: true },
  ];
  const suggestedName = (loaded: Loaded): string =>
    t("nameTaken.suggestion", { name: restoredName(loaded) });

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
    // A refusal for good, and a `conflict` the server explained with a code of its own — a name
    // already taken, a reference it will not accept: the change never applied, and the reason is the
    // code, not "two versions of the same row".
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

  function footer() {
    if (view.kind !== "resolve") {
      return (
        <Button size="lg" block variant="secondary" onClick={onClose}>
          {common("close")}
        </Button>
      );
    }
    const { operation } = view;
    // A refusal the server made for good will be refused again: discarding is the way out, and
    // trying again is the second chance for the case where what blocked it has since been fixed.
    const discardFirst = operation.status === "failed";
    const discard = (
      <Button
        size="lg"
        block
        variant={discardFirst ? "dangerSolid" : "ghost"}
        disabled={busy}
        onClick={() => void resolve((db) => discardOperation(db, operation.seq))}
      >
        {discardFirst ? t("discard") : t("keepServer")}
      </Button>
    );
    const retry = (
      <Button
        size="lg"
        block
        variant={discardFirst ? "secondary" : "primary"}
        disabled={busy}
        onClick={() => void resolve((db) => retryOperation(db, operation.seq))}
      >
        {discardFirst ? t("retry") : t("keepMine")}
      </Button>
    );
    // The name is the whole refusal, so the way out is a different one. "Try again" is not offered:
    // the same name would be refused again, and the body of the sheet says so.
    if (isNameTaken(operation)) {
      const typed = (renameTo ?? suggestedName(view)).trim();
      return (
        <>
          <Button
            size="lg"
            block
            variant="primary"
            disabled={busy || typed === ""}
            onClick={() => void resolve((db) => restoreWithName(db, operation.seq, typed))}
          >
            {t("nameTaken.confirm", { name: typed })}
          </Button>
          {discard}
        </>
      );
    }
    // Trying again as it is would earn the same refusal: what unblocks this one is restoring the
    // account, and the other way out — moving the movement to another account — is an ordinary edit.
    if (isArchivedAccount(operation)) {
      return (
        <>
          <Button
            size="lg"
            block
            variant="primary"
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
          </Button>
          {discard}
        </>
      );
    }
    return discardFirst ? (
      <>
        {discard}
        {retry}
      </>
    ) : (
      <>
        {retry}
        {discard}
      </>
    );
  }

  return (
    <Sheet open={open} onClose={onClose} title={t("title")} footer={footer()}>
      {body()}
    </Sheet>
  );
}
