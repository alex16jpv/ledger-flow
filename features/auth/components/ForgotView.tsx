"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { AuthHeading } from "@/components/shell/AuthFrame";

import { carriedEmail, carryEmail, lastSentCode, rememberSentCode, type SentCode } from "../carry";
import { useFinishReset } from "../hooks";
import { ForgotRequestForm } from "./ForgotRequestForm";
import { ResetCodeForm } from "./ResetCodeForm";

const secondsUntil = (at: number) => Math.max(0, Math.ceil((at - Date.now()) / 1000));

export function ForgotView() {
  const t = useTranslations("auth");
  const finish = useFinishReset();
  const [sent, setSent] = useState<SentCode | null>(() => lastSentCode());
  const [email, setEmail] = useState(() => lastSentCode()?.email ?? carriedEmail());
  useEffect(() => {
    carryEmail("");
  }, []);

  if (!sent) {
    return (
      <div className="flex flex-col gap-5">
        <AuthHeading title={t("forgot.title")} subtitle={t("forgot.subtitle")} />
        <ForgotRequestForm
          defaultEmail={email}
          onSent={(address, resendAfterSeconds) => {
            const next = { email: address, resendAt: Date.now() + resendAfterSeconds * 1000 };
            rememberSentCode(next);
            setSent(next);
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <AuthHeading
        title={t("reset.title")}
        subtitle={t.rich("reset.subtitle", {
          email: sent.email,
          b: (chunks) => <b className="font-semibold text-text">{chunks}</b>,
        })}
      />
      <ResetCodeForm
        email={sent.email}
        resendAfterSeconds={secondsUntil(sent.resendAt)}
        onChangeEmail={() => {
          rememberSentCode(null);
          setEmail(sent.email);
          setSent(null);
        }}
        onResent={(seconds) => {
          const next = { email: sent.email, resendAt: Date.now() + seconds * 1000 };
          rememberSentCode(next);
          setSent(next);
        }}
        onDone={(session) => {
          rememberSentCode(null);
          finish(session);
        }}
      />
    </div>
  );
}
