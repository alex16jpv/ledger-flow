"use client";

import { ArchiveRestore, WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { AuthHeading } from "@/components/shell/AuthFrame";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { RateLimitAlert } from "@/components/ui/RateLimitAlert";
import { Tile } from "@/components/ui/Tile";
import { ApiError } from "@/lib/api/errors";
import { useCalendarDay } from "@/lib/i18n/useCalendarDay";
import { iconProps } from "@/lib/icons/sizes";
import { useOffline } from "@/lib/network/useOffline";
import type { SessionUser } from "@/lib/session/api";
import type { DeletedAccount } from "@/types/api";

import { retryAfterOf, useRestoreDeletedAccount } from "../hooks";
import type { LoginValues } from "../schemas";

type Failure = "wrongPassword" | "failed" | null;

const bold = (chunks: React.ReactNode) => <b className="font-semibold text-text">{chunks}</b>;

interface RestoreAccountStepProps {
  credentials: LoginValues;
  deleted: DeletedAccount;
  onNotNow: () => void;
  onRestored: (session: SessionUser) => void;
}

export function RestoreAccountStep({
  credentials,
  deleted,
  onNotNow,
  onRestored,
}: RestoreAccountStepProps) {
  const t = useTranslations("auth.login");
  const tAuth = useTranslations("auth");
  const offline = useOffline();
  const calendarDay = useCalendarDay();
  const restore = useRestoreDeletedAccount();
  const [failure, setFailure] = useState<Failure>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  const restoreNow = async () => {
    setFailure(null);
    try {
      onRestored(await restore.mutateAsync(credentials));
    } catch (error) {
      const wait = retryAfterOf(error);
      if (wait !== null) setRetryAfter(wait);
      else
        setFailure(error instanceof ApiError && error.status === 401 ? "wrongPassword" : "failed");
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-2 text-center">
        <Tile size="lg" color={null}>
          <ArchiveRestore {...iconProps("lg")} />
        </Tile>
        <AuthHeading
          title={t("restore.title")}
          subtitle={t.rich("restore.body", {
            deletedOn: calendarDay(deleted.deletedOn),
            keptUntil: calendarDay(deleted.keptUntil),
            b: bold,
          })}
        />
      </div>
      <p className="text-center text-sm text-text-2">{t("restore.note")}</p>
      {offline && (
        <Alert tone="warning" icon={WifiOff} title={tAuth("offline")}>
          {t("restore.offline")}
        </Alert>
      )}
      {failure === "wrongPassword" && <Alert tone="danger">{t("invalidCredentials")}</Alert>}
      {failure === "failed" && <Alert tone="danger">{t("restore.failed")}</Alert>}
      {retryAfter !== null && (
        <RateLimitAlert
          retryAfterSeconds={retryAfter}
          onExpire={() => {
            setRetryAfter(null);
          }}
        />
      )}
      <div className="flex flex-col gap-2">
        <Button
          size="lg"
          block
          loading={restore.isPending}
          disabled={offline || retryAfter !== null}
          onClick={() => {
            void restoreNow();
          }}
        >
          {t("restore.submit")}
        </Button>
        <Button variant="ghost" size="lg" block disabled={restore.isPending} onClick={onNotNow}>
          {t("restore.notNow")}
        </Button>
      </div>
    </div>
  );
}
