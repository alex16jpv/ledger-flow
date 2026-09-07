"use client";

import type { IDBPDatabase } from "idb";
import { CircleAlert, CloudCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { PageHeader } from "@/components/shell/PageHeader";
import { SyncConflictSheet } from "@/components/shell/SyncConflictSheet";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Empty } from "@/components/ui/Empty";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ERROR_TABLE, isErrorCode } from "@/lib/api/errors";
import { Link } from "@/lib/i18n/navigation";
import { useDates } from "@/lib/i18n/useDates";
import { iconProps } from "@/lib/icons/sizes";
import { aheadOfServer, clockStore } from "@/lib/local/clock";
import { isFutureDate, isNameTaken } from "@/lib/local/outbox/conflict";
import { operationPayload } from "@/lib/local/outbox/envelope";
import {
  discardBlockedOperations,
  discardImpact,
  discardOperations,
  operationsNeedingAttention,
  restoreArchivedAccount,
  retryOperations,
} from "@/lib/local/outbox/resolve";
import { useOutbox } from "@/lib/local/outbox/useOutbox";
import { currentVault } from "@/lib/local/repository/read";
import type { OutboxOperation, VaultSchema } from "@/lib/local/schema";
import { useBackNavigation } from "@/lib/navigation/history";

interface Item {
  operation: OutboxOperation;
  // What the row is called on this device, when the mirror still holds it.
  name: string | null;
}

type View =
  | { kind: "loading" }
  | { kind: "error" }
  // F-65 keeps its own list: an operation an app update left behind is `pending`, so it never turns
  // up among the ones the server refused, and its way out is not theirs either.
  | { kind: "ready"; items: Item[]; blocked: Item[] };

// F-58: the account the operation names was archived online, so trying again as it is would earn the
// same refusal. Its way out is restoring the account, which travels in the same batch.
const isArchivedAccount = (operation: OutboxOperation): boolean =>
  operation.status === "conflict" && operation.lastError === "RESOURCE_ARCHIVED";

async function nameOf(
  db: IDBPDatabase<VaultSchema>,
  operation: OutboxOperation,
): Promise<string | null> {
  const { entity, entityId } = operation;
  if (entity === "transaction") {
    return (await db.get("transactions", entityId))?.row.description ?? null;
  }
  if (entity === "account") return (await db.get("accounts", entityId))?.row.name ?? null;
  if (entity === "category") return (await db.get("categories", entityId))?.row.name ?? null;
  return (await db.get("budgets", entityId))?.row.name ?? null;
}

async function load(blockedSeqs: readonly number[]): Promise<View> {
  const vault = currentVault();
  // No vault means no queue: there is nothing on this device that could be stuck.
  if (!vault) return { kind: "ready", items: [], blocked: [] };
  try {
    const named = (operation: OutboxOperation): Promise<Item> =>
      nameOf(vault.db, operation).then((name) => ({ operation, name }));
    const operations = await operationsNeedingAttention(vault.db);
    const blocked = (
      await Promise.all(blockedSeqs.map((seq) => vault.db.get("outbox", seq)))
    ).filter((operation): operation is OutboxOperation => operation !== undefined);
    return {
      kind: "ready",
      items: await Promise.all(operations.map(named)),
      blocked: await Promise.all(blocked.map(named)),
    };
  } catch {
    return { kind: "error" };
  }
}

export function AttentionScreen() {
  const t = useTranslations();
  const dates = useDates();
  const back = useBackNavigation();
  const toast = useToast();
  const outbox = useOutbox();
  const [view, setView] = useState<View>({ kind: "loading" });
  const [reloads, setReloads] = useState(0);
  const [busy, setBusy] = useState(false);
  const [comparing, setComparing] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<{ seqs: number[]; impact: number } | null>(null);
  const [kept, setKept] = useState<number[]>([]);
  const offset = useSyncExternalStore(
    clockStore.subscribe,
    clockStore.getSnapshot,
    clockStore.getServerSnapshot,
  );

  useEffect(() => {
    let live = true;
    void load(outbox.blocked).then((next) => {
      if (live) setView(next);
    });
    return () => {
      live = false;
    };
    // The queue is the source: a drain that resolved one of these while the tray was open has to
    // take it off the list rather than leave a decision that no longer exists. The snapshot changes
    // reference on any change of the queue, which the count alone would miss when one operation is
    // resolved and another gets stuck in the same drain.
  }, [reloads, outbox]);

  const act = useCallback(
    async (action: () => Promise<void>) => {
      setBusy(true);
      try {
        await action();
      } finally {
        setBusy(false);
        setReloads((count) => count + 1);
      }
    },
    [setBusy],
  );

  const askDiscard = (seqs: number[]) =>
    act(async () => {
      const vault = currentVault();
      if (!vault) return;
      // Discarding a create takes its dependents with it, and how many is only knowable before
      // anything is deleted: the tray says the real number before it asks.
      setConfirming({ seqs, impact: await discardImpact(vault.db, seqs) });
    });

  const discard = (seqs: number[]) =>
    act(async () => {
      const vault = currentVault();
      if (!vault) return;
      const { discarded } = await discardOperations(vault.db, seqs);
      setConfirming(null);
      toast.show({ message: t("states.attention.discarded", { count: discarded }) });
    });

  const retry = (seqs: number[]) =>
    act(async () => {
      const vault = currentVault();
      if (!vault) return;
      await retryOperations(vault.db, seqs);
      toast.show({ message: t("states.attention.retried", { count: seqs.length }) });
    });

  const restore = (seq: number) =>
    act(async () => {
      const vault = currentVault();
      if (!vault) return;
      if (await restoreArchivedAccount(vault.db, seq)) {
        toast.show({ message: t("states.attention.retried", { count: 1 }) });
        return;
      }
      toast.show({ message: t("states.conflict.archived.gone"), tone: "danger" });
    });

  const items = view.kind === "ready" ? view.items : [];
  const allSeqs = items.map((item) => item.operation.seq);
  const blocked = view.kind === "ready" ? view.blocked : [];

  const discardBlocked = (seqs: number[]) =>
    act(async () => {
      const vault = currentVault();
      if (!vault) return;
      const { discarded } = await discardBlockedOperations(vault.db, seqs);
      toast.show({ message: t("states.attention.discarded", { count: discarded }) });
    });

  // "Keep it here" is the answer that changes nothing on the device: the operation stays, in case a
  // future version knows how to migrate it, and the card stops asking for this visit.
  function blockedCard({ operation, name }: Item) {
    const what = t(`states.conflict.entities.${operation.entity}`);
    const said = saidAbout(operation, what);
    return (
      <Card key={operation.seq} className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-md font-semibold">{name ?? said}</h2>
          <Badge tone="danger">{t("states.attention.blocked.badge")}</Badge>
        </div>
        {name && <p className="text-sm text-text-2">{said}</p>}
        <p className="text-sm text-text-2">{t("states.attention.blocked.reason")}</p>
        {kept.includes(operation.seq) ? (
          <p className="text-sm text-text-3">{t("states.attention.blocked.kept")}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="dangerSolid"
              disabled={busy}
              onClick={() => void discardBlocked([operation.seq])}
            >
              {t("states.conflict.discard")}
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setKept((seqs) => [...seqs, operation.seq]);
              }}
            >
              {t("states.attention.blocked.keep")}
            </Button>
          </div>
        )}
      </Card>
    );
  }

  const moment = (at: Date): string => `${dates.formatDay(at)} ${dates.formatTime(at)}`;

  function reason(operation: OutboxOperation): string {
    const what = t(`states.conflict.entities.${operation.entity}`);
    if (isArchivedAccount(operation)) return t("states.conflict.archived.body", { what });
    // F-60: the code alone would say "the name is already taken" and leave the user to guess whose.
    if (isNameTaken(operation)) {
      const taken = (operation.serverRow as { name?: unknown } | null | undefined)?.name;
      return t("states.conflict.nameTaken.body", {
        what,
        name: typeof taken === "string" ? taken : "",
      });
    }
    // F-66: "the date can't be in the future" left the user to work out which date and how far.
    if (isFutureDate(operation)) {
      const date = (operationPayload(operation).body as { date?: unknown } | undefined)?.date;
      const skew = aheadOfServer(offset);
      const line = t("states.conflict.futureDate.reason", {
        date: typeof date === "string" ? moment(new Date(date)) : "",
      });
      if (!skew) return line;
      return `${line} ${t(
        skew.unit === "days"
          ? "states.conflict.futureDate.skewDays"
          : "states.conflict.futureDate.skewHours",
        { count: skew.count },
      )}`;
    }
    // A `conflict` the server explained with a code of its own — a name already taken, a reference
    // it will not take — never applied either, and the code is the reason. Only `STALE_UPDATE` is
    // the same row written in two places.
    if (operation.status !== "failed" && operation.lastError === "STALE_UPDATE") {
      return t("states.conflict.stale.body", { what });
    }
    const code = operation.lastError;
    return t("states.conflict.failed.body", {
      what,
      reason:
        code && isErrorCode(code)
          ? t(ERROR_TABLE[code].messageKey)
          : (code ?? t("states.conflict.failed.unknown")),
    });
  }

  // next-intl types a key against the message tree, and the action is read off the envelope.
  // `t.has` is the guard; the cast is the one this indirection costs, as in the sheet.
  type MessageKey = Parameters<typeof t>[0];
  function saidAbout(operation: OutboxOperation, what: string): string {
    const key = `states.conflict.actions.${operation.action}` as MessageKey;
    return t.has(key) ? t(key, { what }) : what;
  }

  function kind(operation: OutboxOperation): string {
    if (isArchivedAccount(operation)) return t("states.attention.kinds.archived");
    if (isNameTaken(operation)) return t("states.attention.kinds.nameTaken");
    return t(
      operation.status === "failed"
        ? "states.attention.kinds.failed"
        : "states.attention.kinds.conflict",
    );
  }

  function card({ operation, name }: Item) {
    const what = t(`states.conflict.entities.${operation.entity}`);
    const said = saidAbout(operation, what);
    const refused = operation.status === "failed";
    const archived = isArchivedAccount(operation);
    // The same name would be refused again, so this card has no "Try again": what it offers instead
    // is the rename, which lives inside the comparison sheet (F-60).
    const taken = isNameTaken(operation);
    // The date is what the server refused, so the card leads with correcting it; "Try again" stays,
    // last, for the case where the clock was put right in the meantime (§8.14).
    const badDate = isFutureDate(operation);
    return (
      <Card key={operation.seq} className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-md font-semibold">{name ?? said}</h2>
          <Badge tone="danger">{kind(operation)}</Badge>
        </div>
        {name && <p className="text-sm text-text-2">{said}</p>}
        <p className="text-sm text-text-2">{reason(operation)}</p>
        <div className="flex flex-wrap gap-2">
          {taken || badDate ? (
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => {
                setComparing(operation.seq);
              }}
            >
              {taken
                ? t("states.attention.restoreWithName")
                : t("states.conflict.futureDate.title")}
            </Button>
          ) : (
            <>
              <Button
                variant={refused ? "dangerSolid" : "secondary"}
                disabled={busy}
                onClick={() => void askDiscard([operation.seq])}
              >
                {t(refused ? "states.conflict.discard" : "states.conflict.keepServer")}
              </Button>
              <Button
                variant={refused ? "secondary" : "primary"}
                disabled={busy}
                onClick={() =>
                  archived ? void restore(operation.seq) : void retry([operation.seq])
                }
              >
                {archived
                  ? t("states.conflict.archived.restore")
                  : t(refused ? "states.conflict.retry" : "states.conflict.keepMine")}
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => {
              setComparing(operation.seq);
            }}
          >
            {t("states.attention.compare")}
          </Button>
          {(taken || badDate) && (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => void askDiscard([operation.seq])}
            >
              {t("states.conflict.discard")}
            </Button>
          )}
          {badDate && (
            <Button variant="ghost" disabled={busy} onClick={() => void retry([operation.seq])}>
              {t("states.conflict.retry")}
            </Button>
          )}
        </div>
      </Card>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
      <PageHeader
        title={
          items.length + blocked.length > 0
            ? t("states.attention.titleCount", { count: items.length + blocked.length })
            : t("states.attention.title")
        }
        onBack={() => {
          back("/home");
        }}
      />
      {view.kind === "loading" ? (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label={t("states.loading")}>
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      ) : view.kind === "error" ? (
        <Empty
          tone="danger"
          icon={<CircleAlert {...iconProps("lg")} />}
          title={t("states.error.title")}
          body={t("states.error.body")}
          action={
            <Button
              onClick={() => {
                setReloads((count) => count + 1);
              }}
            >
              {t("common.retry")}
            </Button>
          }
        />
      ) : items.length === 0 && blocked.length === 0 ? (
        <Empty
          icon={<CloudCheck {...iconProps("lg")} />}
          title={t("states.attention.empty.title")}
          body={t("states.attention.empty.body")}
          action={
            <Link href="/home" className={buttonClasses({})}>
              {t("states.attention.empty.cta")}
            </Link>
          }
        />
      ) : (
        <>
          {items.length > 0 && (
            <>
              <Alert tone="neutral">{t("states.attention.intro")}</Alert>
              {items.map(card)}
              {items.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void askDiscard(allSeqs)}
                  >
                    {t("states.attention.discardAll")}
                  </Button>
                  <Button variant="secondary" disabled={busy} onClick={() => void retry(allSeqs)}>
                    {t("states.attention.retryAll")}
                  </Button>
                </div>
              )}
            </>
          )}
          {blocked.length > 0 && (
            <>
              <Alert
                tone="danger"
                title={t("states.attention.blocked.alert", { count: blocked.length })}
              >
                {t("states.attention.blocked.alertBody", { count: blocked.length })}
              </Alert>
              {blocked.map(blockedCard)}
              {blocked.length > 1 && (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void discardBlocked(blocked.map((item) => item.operation.seq))}
                >
                  {t("states.attention.blocked.discardAll", { count: blocked.length })}
                </Button>
              )}
              <p className="text-sm text-text-3">{t("states.attention.blocked.foot")}</p>
            </>
          )}
        </>
      )}
      <SyncConflictSheet
        open={comparing !== null}
        seq={comparing}
        onClose={() => {
          setComparing(null);
        }}
      />
      <Sheet
        open={confirming !== null}
        onClose={() => {
          setConfirming(null);
        }}
        title={t("states.attention.confirmTitle", { count: confirming?.impact ?? 0 })}
        footer={
          <>
            <Button
              size="lg"
              block
              variant="dangerSolid"
              loading={busy}
              onClick={() => void discard(confirming?.seqs ?? [])}
            >
              {t("states.attention.confirmCta")}
            </Button>
            <Button
              size="lg"
              block
              variant="ghost"
              onClick={() => {
                setConfirming(null);
              }}
            >
              {t("common.cancel")}
            </Button>
          </>
        }
      >
        <Alert tone="warning">
          {t("states.attention.confirmBody")}
          {confirming && confirming.impact > confirming.seqs.length && (
            <>
              {" "}
              {t("states.attention.confirmCascade", {
                count: confirming.impact - confirming.seqs.length,
              })}
            </>
          )}
        </Alert>
      </Sheet>
    </div>
  );
}
