"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { useToast } from "@/components/ui/Toast";
import type { SessionMarker } from "@/lib/auth/cookies";
import { readSessionMarker } from "@/lib/auth/marker";
import { APP_HOME_PATH } from "@/lib/auth/routes";
import { localePrefix } from "@/lib/i18n/locales";
import { tabChannel } from "@/lib/session/channel";
import { noteAccountSwitched, sessionChangeOf, takeAccountSwitched } from "@/lib/session/switch";

interface AccountSwitchProps {
  vaultUserId: string | undefined;
  mountedMarker: SessionMarker | null;
  expired: boolean;
}

export function AccountSwitch({ vaultUserId, mountedMarker, expired }: AccountSwitchProps) {
  const t = useTranslations("states");
  const locale = useLocale();
  const toast = useToast();
  const owner = useRef<string | undefined>(undefined);
  const leaving = useRef(false);

  useEffect(() => {
    if (takeAccountSwitched()) toast.show({ message: t("accountSwitched") });
  }, [t, toast]);

  useEffect(() => {
    owner.current ??= vaultUserId;
    const first = owner.current;
    if (!first) return undefined;
    const check = () => {
      if (leaving.current) return;
      const change = sessionChangeOf(first, mountedMarker, readSessionMarker(), expired);
      if (!change) return;
      leaving.current = true;
      if (change === "resumed") {
        window.location.reload();
        return;
      }
      noteAccountSwitched();
      window.location.assign(
        new URL(`${localePrefix(locale)}${APP_HOME_PATH}`, window.location.origin),
      );
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    const stop = tabChannel.subscribe((message) => {
      if (message.type === "session:signedIn") check();
    });
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", check);
    window.addEventListener("focus", check);
    check();
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", check);
      window.removeEventListener("focus", check);
    };
  }, [vaultUserId, mountedMarker, expired, locale]);

  return null;
}
