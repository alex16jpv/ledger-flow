"use client";

import {
  CloudCheck,
  CloudOff,
  Database,
  HardDrive,
  LogIn,
  MonitorSmartphone,
  RefreshCw,
  ShieldCheck,
  Split,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { List, Row, RowBody, RowLink, RowMeta, RowTitle } from "@/components/ui/Row";
import { Sheet } from "@/components/ui/Sheet";
import { Tile } from "@/components/ui/Tile";
import { useToast } from "@/components/ui/Toast";
import { LOGIN_PATH, REAUTH_PARAM } from "@/lib/auth/routes";
import { Link } from "@/lib/i18n/navigation";
import { useDates } from "@/lib/i18n/useDates";
import { iconProps } from "@/lib/icons/sizes";
import { forceFullResync } from "@/lib/local/mirror";
import { syncTransport } from "@/lib/local/outbox/engine";
import { useOutbox } from "@/lib/local/outbox/useOutbox";
import { connectivityStore } from "@/lib/network/connectivity";
import { warmAppShell } from "@/lib/pwa/service-worker";
import { useSession } from "@/lib/session";

import { useSyncSnapshot } from "../sync";

function StatusRow({
  icon,
  title,
  value,
  meta,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  meta?: string;
  action?: React.ReactNode;
}) {
  return (
    <Row className="min-h-14">
      <Tile size="sm" color="GRAY">
        {icon}
      </Tile>
      <RowBody>
        <RowTitle>
          <span>{title}</span>
        </RowTitle>
        {meta && <RowMeta items={[meta]} />}
      </RowBody>
      <span className="text-sm text-text-2">{value}</span>
      {action}
    </Row>
  );
}

const formatBytes = (bytes: number): string => {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} kB`;
};

export function SyncStatusView() {
  const t = useTranslations("settings.sync");
  const dates = useDates();
  const outbox = useOutbox();
  const toast = useToast();
  const session = useSession();
  const locale = useLocale();
  const { snapshot, reload } = useSyncSnapshot();
  const [confirming, setConfirming] = useState(false);
  const [resyncing, setResyncing] = useState(false);

  const storage = snapshot.storage;
  const userId = snapshot.userId;
  // Resyncing throws the copy away before it downloads a new one, so with no network it would leave
  // the app with nothing to read until the connection came back.
  const offline =
    useSyncExternalStore(
      connectivityStore.subscribe,
      connectivityStore.getSnapshot,
      connectivityStore.getServerSnapshot,
    ) === "offline";

  // F-41: a screen that says what this device owes the server cannot stay quiet about there being
  // nobody to say it to. The stripe warns; this row answers whoever came to look.
  const signedOut = session.status === "expired";

  // F-54: "offline ready" is two halves — the data the pull left in the vault, and the screens the
  // worker warmed. It is ready only when both are, and with no network what is missing stays
  // missing, which is a state of its own and not a slower "preparing".
  const blocked = outbox.blocked.length;
  const shell = snapshot.shell;
  const offlineReady = Boolean(snapshot.syncedAt) && shell.cached >= shell.expected;

  const persisted = !storage?.supported
    ? t("persisted.unsupported")
    : storage.persisted
      ? t("persisted.yes")
      : t("persisted.no");

  return (
    <>
      <PageHeader title={t("title")} />

      {/* F-65: an app update left these behind and nothing the user does from here sends them. */}
      {blocked > 0 && (
        <Alert tone="danger" title={t("blocked.alert", { count: blocked })}>
          <span className="flex flex-col items-start gap-2">
            {t("blocked.alertBody", { count: blocked })}
            <Link href="/sync" className={buttonClasses({ variant: "secondary", size: "sm" })}>
              {t("blocked.cta", { count: blocked })}
            </Link>
          </span>
        </Alert>
      )}

      {snapshot.mode === "browser" && <Alert tone="warning">{t("durability.warning")}</Alert>}

      <Card flush>
        <List>
          <StatusRow
            icon={<LogIn {...iconProps("sm")} />}
            title={t("session.label")}
            meta={signedOut ? t("session.signedOutHelp") : t("session.help")}
            value={signedOut ? t("session.signedOut") : t("session.active")}
            action={
              signedOut ? (
                // `reauth` is what gets a device with a live marker past the proxy and onto the
                // login (§2.6).
                <Link
                  href={`${LOGIN_PATH}?${REAUTH_PARAM}=1`}
                  className={buttonClasses({ variant: "secondary", size: "sm" })}
                >
                  {t("session.signIn")}
                </Link>
              ) : undefined
            }
          />
          <StatusRow
            icon={<Database {...iconProps("sm")} />}
            title={t("cursor.label")}
            meta={t("cursor.help")}
            value={snapshot.cursor ? t("cursor.set") : t("cursor.never")}
          />
          <StatusRow
            icon={<RefreshCw {...iconProps("sm")} />}
            title={t("lastSync.label")}
            value={
              snapshot.syncedAt ? dates.formatDay(new Date(snapshot.syncedAt)) : t("lastSync.never")
            }
          />
          <StatusRow
            icon={<CloudCheck {...iconProps("sm")} />}
            title={t("offlineReady.label")}
            meta={
              offlineReady
                ? t("offlineReady.help")
                : offline
                  ? t("offlineReady.incompleteHelp")
                  : t("offlineReady.preparingHelp", {
                      cached: shell.cached,
                      expected: shell.expected,
                    })
            }
            value={
              offlineReady
                ? t("offlineReady.ready")
                : offline
                  ? t("offlineReady.incomplete")
                  : t("offlineReady.preparing")
            }
            action={
              !offlineReady && offline ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={offline}
                  onClick={() => {
                    void warmAppShell(locale).then(reload);
                  }}
                >
                  {t("offlineReady.retry")}
                </Button>
              ) : undefined
            }
          />
          <StatusRow
            icon={<CloudOff {...iconProps("sm")} />}
            title={t("queue.label")}
            meta={
              blocked > 0
                ? t("blocked.queueMeta")
                : outbox.lastError
                  ? t("lastError.label", { code: outbox.lastError })
                  : undefined
            }
            value={blocked > 0 ? t("blocked.queue", { count: blocked }) : String(outbox.pending)}
          />
          {/* Only when it fell back: a server without `POST /sync` takes the queue one operation at
              a time, and support has no other way to see it. */}
          {syncTransport() === "routes" && (
            <StatusRow
              icon={<Split {...iconProps("sm")} />}
              title={t("transport.label")}
              meta={t("transport.help")}
              value={t("transport.routes")}
            />
          )}
          <StatusRow
            icon={<HardDrive {...iconProps("sm")} />}
            title={t("storage.label")}
            value={
              storage?.usageBytes === null || storage?.usageBytes === undefined
                ? t("storage.unknown")
                : formatBytes(storage.usageBytes)
            }
          />
          <StatusRow
            icon={<ShieldCheck {...iconProps("sm")} />}
            title={t("persisted.label")}
            meta={t("persisted.help")}
            value={persisted}
          />
          <StatusRow
            icon={<MonitorSmartphone {...iconProps("sm")} />}
            title={t("mode.label")}
            value={snapshot.mode === "installed" ? t("mode.installed") : t("mode.browser")}
          />
        </List>
      </Card>

      <Card flush>
        <List>
          <RowLink href="/sync" className="min-h-14">
            <Tile size="sm" color="ORANGE">
              <CloudOff {...iconProps("sm")} />
            </Tile>
            <RowBody>
              <RowTitle>
                <span>{t("tray.title")}</span>
              </RowTitle>
              <RowMeta
                items={[
                  outbox.attention > 0
                    ? t("tray.stuck", { count: outbox.attention })
                    : t("tray.empty"),
                ]}
              />
            </RowBody>
          </RowLink>
        </List>
      </Card>

      <div className="flex flex-col gap-2">
        <Button
          variant="secondary"
          block
          disabled={!userId || resyncing || offline}
          onClick={() => {
            setConfirming(true);
          }}
        >
          <RefreshCw {...iconProps("sm")} />
          {t("resync.cta")}
        </Button>
        <p className="text-xs text-text-3">
          {t("resync.help")}
          {offline && ` ${t("resync.offline")}`}
        </p>
      </div>

      <Sheet
        open={confirming}
        onClose={() => {
          setConfirming(false);
        }}
        title={t("resync.confirmTitle")}
        footer={
          <div className="flex flex-col gap-2">
            <Button
              size="lg"
              block
              disabled={resyncing}
              onClick={() => {
                if (!userId) return;
                setResyncing(true);
                forceFullResync(userId)
                  .then(() => {
                    toast.show({ message: t("resync.done") });
                    reload();
                  })
                  .catch(() => {
                    toast.show({ message: t("resync.failed"), tone: "danger" });
                  })
                  .finally(() => {
                    setResyncing(false);
                    setConfirming(false);
                  });
              }}
            >
              {t("resync.confirm")}
            </Button>
            <Button
              variant="ghost"
              size="lg"
              block
              onClick={() => {
                setConfirming(false);
              }}
            >
              {t("resync.cancel")}
            </Button>
          </div>
        }
      >
        <Alert tone="warning">{t("resync.confirmBody", { count: outbox.pending })}</Alert>
      </Sheet>
    </>
  );
}
