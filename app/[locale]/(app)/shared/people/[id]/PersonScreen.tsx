"use client";

import { Archive, ArchiveRestore, HandCoins, Pencil, User, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Avatar } from "@/components/shell/Avatar";
import { PageHeader } from "@/components/shell/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Amount } from "@/components/ui/Amount";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Empty } from "@/components/ui/Empty";
import { LoadErrorBody } from "@/components/ui/LoadErrorBody";
import { Projected } from "@/components/ui/Projected";
import { List, RowBody, rowClasses, RowMeta, RowRight, RowTitle } from "@/components/ui/Row";
import { Sheet, SheetCancel } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tile } from "@/components/ui/Tile";
import { useToast } from "@/components/ui/Toast";
import { ContactFormSheet } from "@/features/shared/components/ContactFormSheet";
import { StateBadge } from "@/features/shared/components/parts";
import {
  useArchiveContact,
  useContactQuery,
  useDeleteSettlement,
  useRestoreContact,
  useSharedPending,
  useSharedSection,
} from "@/features/shared/hooks";
import { personView, type SharedSection } from "@/features/shared/ledger";
import { partyPending, type SharedPending } from "@/features/shared/pending";
import { hasSomethingToSettle, settlePerson } from "@/features/shared/settle";
import { presentError } from "@/lib/api/errors";
import { Link } from "@/lib/i18n/navigation";
import { useMoney } from "@/lib/i18n/useMoney";
import { iconProps } from "@/lib/icons/sizes";
import { useBackNavigation } from "@/lib/navigation/history";
import type { Contact, Settlement } from "@/types/api";

import { PaymentRows } from "../../PaymentRows";
import { SettleUpSheet } from "../../SettleUpSheet";
import { UndoPaymentSheet } from "../../UndoPaymentSheet";

function Payments({
  section,
  contactId,
  pending,
  onUndo,
}: {
  section: SharedSection;
  contactId: string;
  pending: SharedPending;
  onUndo: (settlement: Settlement) => void;
}) {
  const t = useTranslations("shared.person");
  const rows = section.settlements.filter((one) => one.counterparty.contactId === contactId);
  if (rows.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-md font-semibold">{t("payments")}</h2>
      <Card flush>
        <List>
          <PaymentRows rows={rows} pending={pending} onUndo={onUndo} />
        </List>
      </Card>
    </section>
  );
}

function PersonBody({
  contact,
  section,
  onUndo,
}: {
  contact: Contact;
  section: SharedSection;
  onUndo: (settlement: Settlement) => void;
}) {
  const t = useTranslations();
  const money = useMoney();
  const view = personView(section, contact.id);
  const pending = useSharedPending(section);
  const net = view?.net ?? 0;
  const groups = section.groups.flatMap((group) => {
    const person = group.people.find((one) => one.contactId === contact.id);
    return person ? [{ group, person }] : [];
  });

  return (
    <>
      <Card className="flex flex-col items-center gap-2 py-6 text-center">
        <Avatar name={contact.name} color={contact.color} size="lg" />
        <h2 className="text-xl font-semibold tracking-[-0.02em]">{contact.name}</h2>
        {contact.email && <span className="text-sm text-text-3">{contact.email}</span>}
        <Projected when={pending.people.has(contact.id)}>
          <Amount value={Math.abs(net)} signed={false} size="hero" />
        </Projected>
        {/* Colour is data, so the direction is a word: a debt is neither income nor spending. */}
        <span className="text-sm text-text-3">
          {t(net >= 0 ? "shared.person.owesYou" : "shared.person.youOwe", {
            count: groups.length,
          })}
        </span>
      </Card>
      {groups.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-md font-semibold">{t("shared.person.groups")}</h2>
          <Card flush>
            <List>
              {groups.map(({ group, person }) => (
                <Link
                  key={group.group.id}
                  href={`/shared/groups/${group.group.id}`}
                  className={rowClasses({ interactive: true })}
                >
                  <Tile color={group.group.color}>
                    <Users {...iconProps("md")} />
                  </Tile>
                  <RowBody>
                    <RowTitle>
                      <span>{group.group.name}</span>
                      <StateBadge state={person.state} />
                    </RowTitle>
                    <RowMeta
                      items={[
                        t("shared.person.paidOf", {
                          paid: money.format(person.paid),
                          share: money.format(person.share),
                        }),
                      ]}
                    />
                  </RowBody>
                  <RowRight
                    sub={t(
                      person.owesYou >= person.youOwe
                        ? "shared.people.owesYouWord"
                        : "shared.people.youOweWord",
                    )}
                  >
                    <Projected when={partyPending(pending, group.group.id, person.key)}>
                      <Amount value={Math.abs(person.owesYou - person.youOwe)} signed={false} />
                    </Projected>
                  </RowRight>
                </Link>
              ))}
            </List>
          </Card>
        </section>
      )}
      <Payments section={section} contactId={contact.id} pending={pending} onUndo={onUndo} />
      {/* A person is not an account, and this is where the section says so. */}
      <p className="px-1 text-center text-xs text-text-3">{t("shared.person.notAnAccount")}</p>
    </>
  );
}

export function PersonScreen({ id }: { id: string }) {
  const t = useTranslations();
  const back = useBackNavigation();
  const toast = useToast();
  const contact = useContactQuery(id);
  const shared = useSharedSection();
  const archive = useArchiveContact();
  const restore = useRestoreContact();
  const undo = useDeleteSettlement();
  const [sheet, setSheet] = useState<"edit" | "archive" | "settle" | null>(null);
  const [undoing, setUndoing] = useState<Settlement | null>(null);
  const row = contact.data;
  const party = shared.section ? settlePerson(shared.section, id) : undefined;
  // The figure is the ledger's, not the contact's: neither half may draw without the other.
  const pending = contact.isPending || shared.isPending;
  const failed = contact.isError || shared.isError;

  async function confirmArchive() {
    if (!row) return;
    try {
      await archive.mutateAsync(row.id);
      setSheet(null);
      toast.show({ message: t("shared.person.archived") });
    } catch (error) {
      setSheet(null);
      toast.show({ message: t(presentError(error).messageKey), tone: "danger" });
    }
  }

  async function confirmUndo(settlement: Settlement) {
    try {
      await undo.mutateAsync(settlement.id);
      setUndoing(null);
      toast.show({ message: t("shared.undoPayment.done") });
    } catch (error) {
      setUndoing(null);
      toast.show({ message: t(presentError(error, true).messageKey), tone: "danger" });
    }
  }

  async function confirmRestore() {
    if (!row) return;
    try {
      await restore.mutateAsync({ id: row.id });
      toast.show({ message: t("shared.person.restored") });
    } catch (error) {
      toast.show({ message: t(presentError(error).messageKey), tone: "danger" });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={row?.name ?? t("shared.person.title")}
        onBack={() => {
          back("/shared");
        }}
      />
      {pending ? (
        <div role="status" aria-busy="true" aria-label={t("common.loading")}>
          <Card className="flex flex-col items-center gap-3 py-6">
            <Skeleton className="size-16 rounded-full" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-9 w-40" />
          </Card>
        </div>
      ) : failed || !row || !shared.section ? (
        <Empty
          tone="danger"
          icon={<User {...iconProps("lg")} />}
          title={t("states.error.title")}
          body={<LoadErrorBody error={contact.error ?? shared.error} />}
          action={
            <Button
              onClick={() => {
                void contact.refetch();
                shared.refetch();
              }}
            >
              {t("common.retry")}
            </Button>
          }
        />
      ) : (
        <>
          <PersonBody contact={row} section={shared.section} onUndo={setUndoing} />
          {party && hasSomethingToSettle(party) && (
            <Button
              size="lg"
              block
              onClick={() => {
                setSheet("settle");
              }}
            >
              <HandCoins {...iconProps("sm")} />
              {t("shared.group.settleUp")}
            </Button>
          )}
          {row.archivedAt === null ? (
            <div className="flex gap-3">
              <Button
                variant="secondary"
                size="lg"
                className="flex-1"
                onClick={() => {
                  setSheet("edit");
                }}
              >
                <Pencil {...iconProps("sm")} />
                {t("shared.person.edit")}
              </Button>
              <Button
                variant="secondary"
                size="lg"
                className="flex-1"
                onClick={() => {
                  setSheet("archive");
                }}
              >
                <Archive {...iconProps("sm")} />
                {t("shared.person.archive.label")}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Alert tone="warning">{t("shared.person.isArchived")}</Alert>
              <Button
                variant="secondary"
                size="lg"
                loading={restore.isPending}
                onClick={() => {
                  void confirmRestore();
                }}
              >
                <ArchiveRestore {...iconProps("sm")} />
                {t("shared.person.restore")}
              </Button>
            </div>
          )}
          {sheet === "edit" && (
            <ContactFormSheet
              open
              contact={row}
              onClose={() => {
                setSheet(null);
              }}
            />
          )}
          <Sheet
            layout="dialog"
            open={sheet === "archive"}
            onClose={() => {
              setSheet(null);
            }}
            title={t("shared.person.archive.title", { name: row.name })}
            footer={
              <>
                <Button
                  variant="dangerSolid"
                  size="lg"
                  block
                  loading={archive.isPending}
                  onClick={() => {
                    void confirmArchive();
                  }}
                >
                  {t("shared.person.archive.confirm")}
                </Button>
                <SheetCancel />
              </>
            }
          >
            <Alert tone="warning">{t("shared.person.archive.body")}</Alert>
          </Sheet>
          {sheet === "settle" && party && (
            <SettleUpSheet
              open
              party={party}
              onClose={() => {
                setSheet(null);
              }}
            />
          )}
          {undoing && (
            <UndoPaymentSheet
              open
              settlement={undoing}
              name={row.name}
              pending={undo.isPending}
              onClose={() => {
                setUndoing(null);
              }}
              onConfirm={() => {
                void confirmUndo(undoing);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
