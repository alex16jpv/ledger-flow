"use client";

import { Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { List, Row, RowBody } from "@/components/ui/Row";
import { Tile } from "@/components/ui/Tile";
import { useToast } from "@/components/ui/Toast";
import { ApiError, presentError } from "@/lib/api/errors";
import { useFormatSettings } from "@/lib/i18n/FormatSettingsProvider";
import { useDates } from "@/lib/i18n/useDates";
import { iconProps } from "@/lib/icons/sizes";
import { serverNow } from "@/lib/local/clock";
import { isAnswerable } from "@/lib/local/repository";
import { useOffline } from "@/lib/network/useOffline";
import type { ReceivedInvitation } from "@/types/api";

import { useAnswerInvitation, useReceivedInvitations } from "../hooks";

type Answer = "accept" | "decline";

const bold = (chunks: React.ReactNode) => <b className="font-semibold">{chunks}</b>;

function InvitationRow({
  invitation,
  gone,
  busy,
  offline,
  onAnswer,
}: {
  invitation: ReceivedInvitation;
  gone: boolean;
  busy: Answer | null;
  offline: boolean;
  onAnswer: (answer: Answer) => void;
}) {
  const t = useTranslations("shared.invitations");
  const dates = useDates();
  const { currency } = useFormatSettings();
  const email = invitation.inviterEmail;
  const otherCurrency = invitation.groupCurrency !== currency;
  const open = !gone && isAnswerable(invitation);
  const sent = dates.formatDay(new Date(invitation.createdAt));
  const sentenceId = useId();

  let meta: string;
  let badge: React.ReactNode = null;
  if (gone) {
    meta = t("gone", { email });
    badge = <Badge>{t("unavailable")}</Badge>;
  } else if (invitation.status === "ACCEPTED") {
    meta = t("joinedNow", { email });
    badge = <Badge tone="success">{t("joined")}</Badge>;
  } else if (invitation.status === "DECLINED") {
    meta = t("declinedNow", { email });
    badge = <Badge>{t("declined")}</Badge>;
  } else if (otherCurrency) {
    meta = t("otherCurrency", {
      email,
      date: sent,
      group: invitation.groupCurrency,
      mine: currency,
    });
  } else {
    meta = t("sent", {
      email,
      date: sent,
      until: dates.formatDay(new Date(invitation.expiresAt)),
    });
  }

  return (
    <Row className="items-start">
      <Tile color={invitation.groupColor}>
        <Users {...iconProps("md")} />
      </Tile>
      <RowBody className="gap-1">
        <span id={sentenceId} className="text-base">
          {t.rich("sentence", {
            inviter: invitation.inviterName,
            group: invitation.groupName,
            b: bold,
          })}
        </span>
        <span className="text-sm text-text-3">{meta}</span>
        {open ? (
          <span className="flex flex-wrap gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              aria-describedby={sentenceId}
              disabled={offline || busy !== null}
              loading={busy === "decline"}
              onClick={() => {
                onAnswer("decline");
              }}
            >
              {t("decline")}
            </Button>
            {!otherCurrency && (
              <Button
                size="sm"
                aria-describedby={sentenceId}
                disabled={offline || busy !== null}
                loading={busy === "accept"}
                onClick={() => {
                  onAnswer("accept");
                }}
              >
                {t("accept")}
              </Button>
            )}
          </span>
        ) : (
          badge && <span className="pt-1">{badge}</span>
        )}
      </RowBody>
    </Row>
  );
}

export function InvitationsBlock() {
  const t = useTranslations();
  const toast = useToast();
  const offline = useOffline();
  const { data } = useReceivedInvitations();
  const answer = useAnswerInvitation();
  const [visitStart] = useState(() => serverNow());
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const [answered, setAnswered] = useState<ReadonlyMap<string, ReceivedInvitation>>(new Map());
  const [busy, setBusy] = useState<{ id: string; answer: Answer } | null>(null);

  const known = new Map((data ?? []).map((row) => [row.id, row]));
  for (const [id, row] of answered) known.set(id, row);
  const rows = [...known.values()]
    .filter(
      (invitation) =>
        gone.has(invitation.id) ||
        isAnswerable(invitation) ||
        ((invitation.status === "ACCEPTED" || invitation.status === "DECLINED") &&
          invitation.answeredAt !== null &&
          Date.parse(invitation.answeredAt) >= visitStart),
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (rows.length === 0) return null;
  const waiting = rows.filter((row) => !gone.has(row.id) && isAnswerable(row)).length;

  async function respond(invitation: ReceivedInvitation, choice: Answer) {
    setBusy({ id: invitation.id, answer: choice });
    try {
      const row = await answer.mutateAsync({ id: invitation.id, answer: choice });
      setAnswered((was) => new Map(was).set(row.id, row));
    } catch (error) {
      const code = error instanceof ApiError ? error.code : null;
      if (code === "INVITATION_UNAVAILABLE" || code === "NOT_FOUND") {
        setGone((was) => new Set(was).add(invitation.id));
      } else if (code === "CURRENCY_MISMATCH") {
        toast.show({ message: t("shared.invitations.otherCurrencyRefused"), tone: "danger" });
      } else if (code === "PARTICIPANT_ALREADY_IN_GROUP") {
        toast.show({ message: t("shared.invitations.alreadyIn"), tone: "danger" });
      } else {
        toast.show({ message: t(presentError(error).messageKey), tone: "danger" });
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="flex flex-col gap-2" aria-labelledby="shared-invitations">
      <div className="flex items-center justify-between px-1">
        <h2 id="shared-invitations" className="text-md font-semibold">
          {t("shared.invitations.title")}
        </h2>
        {waiting > 0 && (
          <Badge tone="brand">
            <span aria-hidden="true">{waiting}</span>
            <span className="sr-only">{t("nav.waitingCount", { count: waiting })}</span>
          </Badge>
        )}
      </div>
      <Card flush>
        <List>
          {rows.map((invitation) => (
            <InvitationRow
              key={invitation.id}
              invitation={invitation}
              gone={gone.has(invitation.id)}
              busy={busy?.id === invitation.id ? busy.answer : null}
              offline={offline}
              onAnswer={(choice) => {
                void respond(invitation, choice);
              }}
            />
          ))}
        </List>
      </Card>
      {offline && waiting > 0 && (
        <p role="status" className="px-1 text-xs text-text-2">
          {t("shared.invitations.offline")}
        </p>
      )}
      <p className="px-1 text-xs text-text-3">
        {t(waiting > 0 ? "shared.invitations.foot" : "shared.invitations.answeredFoot")}
      </p>
    </section>
  );
}
