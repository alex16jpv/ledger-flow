"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Avatar } from "@/components/shell/Avatar";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { List, Row, RowBody, RowMeta, RowTitle } from "@/components/ui/Row";
import { Sheet, SheetCancel } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { presentError } from "@/lib/api/errors";
import { useDates } from "@/lib/i18n/useDates";
import { useOffline } from "@/lib/network/useOffline";
import type { Contact, SharedGroup, SyncSharedGroup } from "@/types/api";

import { useGroupInvitations, useInvite, useWithdrawInvitation } from "../hooks";
import {
  type InviteState,
  inviteStateOf,
  latestByContact,
  type PersonInvite,
} from "../invitations";
import { INVITATION_DAYS, MAX_WAITING_INVITATIONS } from "../limits";
import { ContactFormSheet } from "./ContactFormSheet";

const rich = {
  b: (chunks: React.ReactNode) => <b className="font-semibold">{chunks}</b>,
  i: (chunks: React.ReactNode) => <i>{chunks}</i>,
};

export interface InviteSheetProps {
  open: boolean;
  group: SharedGroup | SyncSharedGroup;
  contacts: ReadonlyMap<string, Contact>;
  onClose: () => void;
}

interface PersonAction {
  label: string;
  variant: "secondary" | "ghost";
  run: () => void;
  online: boolean;
}

interface Stopping {
  contact: Contact;
  invitationId: string;
}

function PersonRow({
  contact,
  invite,
  busy,
  offline,
  onInvite,
  onWithdraw,
  onStop,
  onAddEmail,
}: {
  contact: Contact;
  invite: PersonInvite;
  busy: boolean;
  offline: boolean;
  onInvite: () => void;
  onWithdraw: () => void;
  onStop: () => void;
  onAddEmail: () => void;
}) {
  const t = useTranslations("shared.invite");
  const dates = useDates();
  const email = contact.email ?? invite.invitation?.email ?? "";
  const day = (iso: string | null | undefined) => (iso ? dates.formatDay(new Date(iso)) : "");
  const { state, invitation } = invite;

  const meta = {
    noEmail: t("noEmail"),
    notInvited: t("notInvited", { email }),
    waiting: t("waiting", {
      email,
      date: day(invitation?.createdAt),
      until: day(invitation?.expiresAt),
    }),
    expired: t("expired", { email, days: INVITATION_DAYS }),
    joined: t("joinedMeta", { email, date: day(invitation?.answeredAt) }),
    declined: t("declined", { email, date: day(invitation?.answeredAt) }),
    left: t("left", { email, date: day(invitation?.leftAt) }),
  }[state];

  const actions: Record<InviteState, PersonAction> = {
    noEmail: { label: t("addEmail"), variant: "secondary", run: onAddEmail, online: false },
    notInvited: { label: t("invite"), variant: "secondary", run: onInvite, online: true },
    waiting: { label: t("withdraw"), variant: "ghost", run: onWithdraw, online: true },
    expired: { label: t("inviteAgain"), variant: "secondary", run: onInvite, online: true },
    joined: { label: t("stopSharing"), variant: "ghost", run: onStop, online: true },
    declined: { label: t("inviteAgain"), variant: "secondary", run: onInvite, online: true },
    left: { label: t("inviteAgain"), variant: "secondary", run: onInvite, online: true },
  };
  const action = actions[state];

  return (
    <Row>
      <Avatar name={contact.name} color={contact.color ?? null} />
      <RowBody>
        <RowTitle>
          <span>{contact.name}</span>
          {state === "joined" && <Badge tone="success">{t("joined")}</Badge>}
        </RowTitle>
        <RowMeta items={[meta]} />
      </RowBody>
      <Button
        size="sm"
        variant={action.variant}
        loading={busy}
        disabled={action.online && offline}
        onClick={action.run}
      >
        {action.label}
      </Button>
    </Row>
  );
}

export function InviteSheet({ open, group, contacts, onClose }: InviteSheetProps) {
  const t = useTranslations();
  const toast = useToast();
  const offline = useOffline();
  const invitations = useGroupInvitations(group.id);
  const invite = useInvite();
  const withdraw = useWithdrawInvitation();
  const [busy, setBusy] = useState<string | null>(null);
  const [justInvited, setJustInvited] = useState<Contact | null>(null);
  const [stopping, setStopping] = useState<Stopping | null>(null);
  const [editing, setEditing] = useState<Contact | null>(null);

  const latest = latestByContact(invitations.data ?? []);
  const people = group.participants.flatMap((participant) => {
    const contact =
      participant.contactId === null ? undefined : contacts.get(participant.contactId);
    return contact ? [contact] : [];
  });

  async function run(contact: Contact, action: () => Promise<unknown>) {
    setBusy(contact.id);
    try {
      await action();
    } catch (error) {
      toast.show({ message: t(presentError(error).messageKey), tone: "danger" });
    } finally {
      setBusy(null);
    }
  }

  if (editing) {
    return (
      <ContactFormSheet
        open
        contact={editing}
        onClose={() => {
          setEditing(null);
        }}
      />
    );
  }

  if (stopping) {
    const name = stopping.contact.name;
    return (
      <Sheet
        layout="dialog"
        open
        onClose={() => {
          setStopping(null);
        }}
        title={t("shared.invite.stopTitle", { name })}
        footer={
          <>
            <Button
              size="lg"
              block
              variant="dangerSolid"
              loading={withdraw.isPending}
              disabled={offline}
              onClick={() => {
                void run(stopping.contact, async () => {
                  await withdraw.mutateAsync({
                    groupId: group.id,
                    invitationId: stopping.invitationId,
                  });
                  toast.show({ message: t("shared.invite.stopped", { name }) });
                  setStopping(null);
                });
              }}
            >
              {t("shared.invite.stopSharing")}
            </Button>
            <SheetCancel />
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Alert tone="warning">
            {t.rich("shared.invite.stopAlert", { name, group: group.name, ...rich })}
          </Alert>
          <p className="text-sm text-text-3">{t("shared.invite.stopBody")}</p>
          <p className="text-xs text-text-3">{t("shared.invite.stopAgain")}</p>
          {offline && (
            <p role="status" className="text-xs text-text-2">
              {t("shared.invite.offline")}
            </p>
          )}
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      layout="full"
      open={open}
      onClose={onClose}
      title={t("shared.invite.title", { group: group.name })}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-3">
          {t.rich("shared.invite.intro", { group: group.name, ...rich })}
        </p>
        <Card flush>
          <List>
            {people.map((contact) => {
              const person = inviteStateOf(contact.email, latest.get(contact.id));
              return (
                <PersonRow
                  key={contact.id}
                  contact={contact}
                  invite={person}
                  busy={busy === contact.id}
                  offline={offline}
                  onAddEmail={() => {
                    setEditing(contact);
                  }}
                  onInvite={() => {
                    void run(contact, async () => {
                      const row = await invite.mutateAsync({
                        groupId: group.id,
                        contactId: contact.id,
                      });
                      if (row.id !== person.invitation?.id) setJustInvited(contact);
                    });
                  }}
                  onWithdraw={() => {
                    const id = person.invitation?.id;
                    if (!id) return;
                    void run(contact, async () => {
                      await withdraw.mutateAsync({ groupId: group.id, invitationId: id });
                      toast.show({
                        message: t("shared.invite.withdrawn", { name: contact.name }),
                      });
                    });
                  }}
                  onStop={() => {
                    const id = person.invitation?.id;
                    if (id) setStopping({ contact, invitationId: id });
                  }}
                />
              );
            })}
          </List>
        </Card>
        {justInvited && (
          <p role="status" className="text-sm text-text-3">
            {t.rich("shared.invite.sentNote", {
              name: justInvited.name,
              email: justInvited.email ?? "",
              ...rich,
            })}
          </p>
        )}
        {offline && (
          <p role="status" className="text-xs text-text-2">
            {t("shared.invite.offline")}
          </p>
        )}
        <Alert tone="neutral">
          {t.rich("shared.invite.limits", {
            days: INVITATION_DAYS,
            max: MAX_WAITING_INVITATIONS,
            ...rich,
          })}
        </Alert>
      </div>
    </Sheet>
  );
}
