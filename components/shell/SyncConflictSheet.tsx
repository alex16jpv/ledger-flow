"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Amount } from "@/components/ui/Amount";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useDates } from "@/lib/i18n/useDates";
import { type ConflictField, conflictFields } from "@/lib/local/outbox/conflict";
import { discardOperation, retryOperation } from "@/lib/local/outbox/resolve";
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

const MONEY_FIELDS = new Set(["amount", "initialBalance", "creditLimit"]);
const DATE_FIELDS = new Set([
  "date",
  "effectiveFrom",
  "periodStartDate",
  "periodEndDate",
  "archivedAt",
]);
const REFERENCE_FIELDS = new Set(["categoryId", "categoryIds", "fromAccountId", "toAccountId"]);

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

export function SyncConflictSheet({ open, seq, onClose }: SyncConflictSheetProps) {
  const t = useTranslations("states.conflict");
  const common = useTranslations("common");
  const dates = useDates();
  const outbox = useOutbox();
  const [loaded, setLoaded] = useState<{ seq: number; view: View } | null>(null);
  const [busy, setBusy] = useState(false);

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

  function card(title: string, side: "mine" | "theirs", loaded: Loaded) {
    return (
      <section className="flex flex-col gap-2 rounded-md border border-border bg-surface-2 p-3">
        <h3 className="text-xs font-semibold text-text-2 uppercase">{title}</h3>
        <dl className="flex flex-col gap-1.5 text-sm">
          {loaded.fields.map((field) => (
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
    if (operation.status === "failed") {
      return (
        <div className="flex flex-col gap-3">
          <Alert tone="danger" title={t("failed.title")}>
            {t("failed.body", { reason: operation.lastError ?? t("failed.unknown"), what })}
          </Alert>
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
