import { useQueryClient } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { useEffect } from "react";

import { tabChannel } from "@/lib/session/channel";

import { loadSignInAfterWipe } from "./wipe";

export function useWipedElsewhere(): void {
  const queryClient = useQueryClient();
  const locale = useLocale();
  useEffect(
    () =>
      tabChannel.subscribe((message) => {
        if (message.type !== "device:wiped") return;
        queryClient.clear();
        loadSignInAfterWipe(locale);
      }),
    [queryClient, locale],
  );
}
