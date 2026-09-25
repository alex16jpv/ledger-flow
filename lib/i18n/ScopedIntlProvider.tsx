import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import type { ReactNode } from "react";

import { MESSAGE_SCOPES, type MessageScope, pickMessages } from "./scopes";

export async function ScopedIntlProvider({
  scope,
  children,
}: {
  scope: MessageScope;
  children: ReactNode;
}) {
  const messages = pickMessages(await getMessages(), MESSAGE_SCOPES[scope]);
  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}
