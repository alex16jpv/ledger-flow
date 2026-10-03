"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { PROFILE_PATH } from "@/lib/auth/routes";
import { useRouter } from "@/lib/i18n/navigation";
import { secondsUntilServer } from "@/lib/local/clock";
import { useOffline } from "@/lib/network/useOffline";
import type { SessionProfile } from "@/lib/session/api";
import {
  closeConfirmEmail,
  type ConfirmTarget,
  emailUnconfirmed,
  useConfirmEmail,
} from "@/lib/session/confirm-email";
import { useSession } from "@/lib/session/SessionProvider";

import { ConfirmEmailForm, type Final, openingOf } from "./ConfirmEmailForm";

export function ConfirmEmailSheet() {
  const t = useTranslations("states.confirmEmail");
  const { sheetOpen, openings, target } = useConfirmEmail();
  return (
    <Sheet
      layout="dialog"
      open={sheetOpen}
      onClose={closeConfirmEmail}
      title={target === "new" ? t("newSheetTitle") : t("sheetTitle")}
    >
      {sheetOpen && <ConfirmEmailBody key={openings} target={target} />}
    </Sheet>
  );
}

function useConfirmed(target: ConfirmTarget): (email: string) => void {
  const t = useTranslations("states.confirmEmail");
  const toast = useToast();
  const said = useRef(false);
  return useCallback(
    (email: string) => {
      closeConfirmEmail();
      if (said.current) return;
      said.current = true;
      toast.show({ message: target === "new" ? t("newDone", { email }) : t("done") });
    },
    [t, toast, target],
  );
}

function NoLongerWaits({ final }: { final: Final }) {
  const t = useTranslations("states.confirmEmail");
  return final === "taken" ? (
    <Alert tone="danger" title={t("takenTitle")}>
      {t("takenBody")}
    </Alert>
  ) : (
    <Alert tone="warning" title={t("goneTitle")}>
      {t("goneBody")}
    </Alert>
  );
}

function ConfirmEmailBody({ target }: { target: ConfirmTarget }) {
  const t = useTranslations();
  const router = useRouter();
  const session = useSession();
  const offline = useOffline();
  const confirmed = useConfirmed(target);
  const [answer, setAnswer] = useState<{ user: SessionProfile | null } | null>(null);
  const asked = answer !== null;
  const [final, setFinal] = useState<Final | null>(null);
  const refetch = useRef(session.refetch);

  useEffect(() => {
    let wanted = true;
    void refetch.current().then(
      (result) => {
        if (wanted) setAnswer({ user: result.data?.user ?? null });
      },
      () => {
        if (wanted) setAnswer({ user: null });
      },
    );
    return () => {
      wanted = false;
    };
  }, []);

  // What `/me` answered when the sheet opened: the cache can lag it, and later writes must not remount.
  const user = answer?.user ?? session.user;
  const confirmedEmail =
    target === "current" && asked && user !== null && !emailUnconfirmed(user) ? user.email : null;
  const alreadyConfirmed = confirmedEmail !== null;
  useEffect(() => {
    if (confirmedEmail !== null) confirmed(confirmedEmail);
  }, [confirmedEmail, confirmed]);

  if (!user || alreadyConfirmed || (!asked && !offline)) {
    return (
      <div className="flex flex-col gap-4" role="status" aria-busy="true">
        <span className="sr-only">{t("common.loading")}</span>
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }
  const formKey = asked ? "asked" : "cached";
  const changeEmail = () => {
    closeConfirmEmail();
    router.push(PROFILE_PATH);
  };
  if (final) return <NoLongerWaits final={final} />;
  if (target === "new") {
    if (!user.emailChange) return <NoLongerWaits final="gone" />;
    return (
      <ConfirmEmailForm
        key={formKey}
        target="new"
        email={user.emailChange.email}
        opening={{
          shape: "code",
          resendAfterSeconds: secondsUntilServer(user.emailChange.resendAvailableAt),
        }}
        onConfirmed={confirmed}
        onChangeEmail={changeEmail}
        onFinal={setFinal}
      />
    );
  }
  return (
    <ConfirmEmailForm
      key={formKey}
      target="current"
      email={user.email}
      opening={openingOf(user)}
      onConfirmed={confirmed}
      onChangeEmail={changeEmail}
    />
  );
}
