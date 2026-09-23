"use client";

import { Laptop, LogOut, Monitor, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Empty } from "@/components/ui/Empty";
import { List, Row, RowBody, RowMeta, RowMetaDot, RowTitle } from "@/components/ui/Row";
import { Sheet, SheetCancel } from "@/components/ui/Sheet";
import { SkeletonRow } from "@/components/ui/Skeleton";
import { Tile } from "@/components/ui/Tile";
import { useToast } from "@/components/ui/Toast";
import { presentError } from "@/lib/api/errors";
import { useDates } from "@/lib/i18n/useDates";
import { iconProps } from "@/lib/icons/sizes";
import { useOffline } from "@/lib/network/useOffline";

import { useRevokeSession, useSessionsQuery } from "../hooks";
import { describeUserAgent, type DeviceKind } from "../user-agent";

const ICON: Record<DeviceKind, typeof Laptop> = {
  phone: Smartphone,
  laptop: Laptop,
  desktop: Monitor,
};
const ACTIVE_NOW_MS = 5 * 60 * 1000;

export function SessionsView({ onSignOutAll }: { onSignOutAll: () => Promise<void> }) {
  const t = useTranslations();
  const offline = useOffline();
  const dates = useDates();
  const toast = useToast();
  const sessions = useSessionsQuery();
  const revoke = useRevokeSession();
  const [confirming, setConfirming] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [now] = useState(() => Date.now());

  return (
    <div className="flex flex-col gap-4">
      <Alert tone="neutral">{t("settings.sessions.intro")}</Alert>
      {sessions.isPending ? (
        <Card flush role="status" aria-busy="true" aria-label={t("common.loading")}>
          <SkeletonRow />
          <SkeletonRow />
        </Card>
      ) : sessions.isError ? (
        <Empty
          tone="danger"
          icon={<Monitor {...iconProps("lg")} />}
          title={t("states.error.title")}
          action={
            <Button
              onClick={() => {
                void sessions.refetch();
              }}
            >
              {t("common.retry")}
            </Button>
          }
        />
      ) : (
        <Card flush>
          <List>
            {sessions.data.map((session) => {
              const device = describeUserAgent(session.userAgent);
              const Icon = ICON[device.kind];
              const label = device.label ?? t("settings.sessions.unknownDevice");
              const lastUsed = new Date(session.lastUsedAt);
              const activity =
                now - lastUsed.getTime() < ACTIVE_NOW_MS
                  ? t("settings.sessions.activeNow")
                  : `${dates.formatDay(lastUsed)} · ${dates.formatTime(lastUsed)}`;
              return (
                <Row key={session.id}>
                  <Tile className="bg-surface-2 text-text-2">
                    <Icon {...iconProps("md")} />
                  </Tile>
                  <RowBody>
                    <RowTitle>
                      <span>{label}</span>
                    </RowTitle>
                    <span className="flex min-w-0 flex-col items-start gap-0.5 sm:flex-row sm:items-center sm:gap-1.5">
                      <RowMeta items={[activity]} />
                      <RowMetaDot className="hidden sm:block" />
                      <RowMeta
                        items={[
                          t("settings.sessions.since", {
                            date: dates.formatDay(new Date(session.createdAt)),
                          }),
                          t("settings.sessions.expires", {
                            date: dates.formatDay(new Date(session.expiresAt)),
                          }),
                        ]}
                      />
                    </span>
                  </RowBody>
                  {session.current ? (
                    <Badge tone="brand">{t("settings.sessions.thisDevice")}</Badge>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      iconOnly
                      className="sm:w-auto sm:px-3"
                      aria-label={t("settings.sessions.signOutDevice", { device: label })}
                      loading={revoke.isPending && revoke.variables === session.id}
                      onClick={() => {
                        revoke
                          .mutateAsync(session.id)
                          .then(() => {
                            toast.show({ message: t("settings.sessions.signedOut") });
                          })
                          .catch((error: unknown) => {
                            toast.show({
                              message: t(presentError(error).messageKey),
                              tone: "danger",
                            });
                          });
                      }}
                    >
                      <LogOut {...iconProps("sm")} />
                      <span className="hidden sm:inline">{t("settings.sessions.signOut")}</span>
                    </Button>
                  )}
                </Row>
              );
            })}
          </List>
        </Card>
      )}
      <Button
        variant="danger"
        block
        disabled={offline}
        onClick={() => {
          setConfirming(true);
        }}
      >
        <LogOut {...iconProps("sm")} />
        {t("settings.sessions.signOutOthers")}
      </Button>
      {offline && (
        <p className="text-center text-sm text-text-3" role="status">
          {t("settings.signOutOffline")}
        </p>
      )}
      <Sheet
        layout="dialog"
        open={confirming}
        onClose={() => {
          setConfirming(false);
        }}
        title={t("settings.sessions.signOutOthersTitle")}
        footer={
          <>
            <Button
              variant="dangerSolid"
              size="lg"
              block
              loading={signingOut}
              onClick={() => {
                setSigningOut(true);
                void onSignOutAll();
              }}
            >
              {t("settings.sessions.signOutOthersConfirm")}
            </Button>
            <SheetCancel />
          </>
        }
      >
        <Alert tone="warning">{t("settings.sessions.signOutOthersBody")}</Alert>
      </Sheet>
    </div>
  );
}
