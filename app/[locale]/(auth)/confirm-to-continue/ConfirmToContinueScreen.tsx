"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ConfirmToContinueView } from "@/features/auth/components/ConfirmToContinueView";
import { SignOutSheet } from "@/features/settings/components/SettingsSheets";
import { LOGIN_PATH } from "@/lib/auth/routes";
import { useRouter } from "@/lib/i18n/navigation";
import { signOutHere } from "@/lib/session/sign-out";

interface Asking {
  userId: string;
  pending: number;
}

export function ConfirmToContinueScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [asking, setAsking] = useState<Asking | null>(null);

  const signOut = async (userId: string, discardPendingWork: boolean) => {
    setAsking(null);
    await signOutHere(queryClient, userId, { discardPendingWork });
    router.replace(LOGIN_PATH);
  };

  return (
    <>
      <ConfirmToContinueView
        onSignOut={(user, pending) => {
          if (pending > 0) setAsking({ userId: user.id, pending });
          else void signOut(user.id, false);
        }}
      />
      <SignOutSheet
        open={asking !== null}
        pending={asking?.pending ?? 0}
        onClose={() => {
          setAsking(null);
        }}
        onKeep={() => {
          if (asking) void signOut(asking.userId, false);
        }}
        onDiscard={() => {
          if (asking) void signOut(asking.userId, true);
        }}
      />
    </>
  );
}
