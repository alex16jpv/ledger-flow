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
import { List, RowBody, rowClasses, RowMeta, RowRight, RowTitle } from "@/components/ui/Row";
import { Row } from "@/components/ui/Row";
import { Sheet, SheetCancel } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tile } from "@/components/ui/Tile";
import { useToast } from "@/components/ui/Toast";
import { presentError } from "@/lib/api/errors";
import { Link } from "@/lib/i18n/navigation";
import { useDates } from "@/lib/i18n/useDates";
import { useMoney } from "@/lib/i18n/useMoney";
import { iconProps } from "@/lib/icons/sizes";
import { useBackNavigation } from "@/lib/navigation/history";
import type { Contact } from "@/types/api";

import { useArchiveContact, useContactQuery, useRestoreContact, useSharedSection } from "../hooks";
import { personView } from "../ledger";
import { ContactFormSheet } from "./ContactFormSheet";
import { StateBadge } from "./parts";

function Payments({ contactId }: { contactId: string }) {
  const t = useTranslations("shared.person");
  const money = useMoney();
  const dates = useDates();
  const { section } = useSharedSection();
  const rows = (section?.settlements ?? []).filter(
    (one) => one.counterparty.contactId === contactId,
  );
  if (rows.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-md font-semibold">{t("payments")}</h2>
      <Card flush>
        <List>
          {rows.map((one) => {
            const incoming = one.collected > 0;
            return (
              <Row key={one.id}>
                <Tile color="GRAY">
                  <HandCoins {...iconProps("md")} />
                </Tile>
                <RowBody>
                  <RowTitle>
                    <span>
                      {incoming
                        ? t("paidYou", { amount: money.format(one.collected) })
                        : t("youPaid", { amount: money.format(one.paid) })}
                    </span>
                  </RowTitle>
                  <RowMeta
                    items={[
                      dates.formatDay(new Date(one.date)),
                      // Cash the app never saw: no movement was written and no balance moved.
                      one.outsideApp ? t("outsideApp") : null,
                    ].filter(Boolean)}
                  />
                </RowBody>
                <RowRight>
                  <Amount
                    value={incoming ? one.collected : one.paid}
                    kind={incoming ? "settlement" : "settlementOut"}
                  />
                </RowRight>
              </Row>
            );
          })}
        </List>
      </Card>
    </section>
  );
}

function PersonBody({ contact }: { contact: Contact }) {
  const t = useTranslations();
  const money = useMoney();
  const { section } = useSharedSection();
  const view = section && personView(section, contact.id);
  const net = view?.net ?? 0;
  const groups = (section?.groups ?? []).flatMap((group) => {
    const person = group.people.find((one) => one.contactId === contact.id);
    return person ? [{ group, person }] : [];
  });

  return (
    <>
      <Card className="flex flex-col items-center gap-2 py-6 text-center">
        <Avatar name={contact.name} color={contact.color} size="lg" />
        <h2 className="text-xl font-semibold tracking-[-0.02em]">{contact.name}</h2>
        {contact.email && <span className="text-sm text-text-3">{contact.email}</span>}
        <Amount value={Math.abs(net)} signed={false} size="hero" />
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
                    <Amount value={Math.abs(person.owesYou - person.youOwe)} signed={false} />
                  </RowRight>
                </Link>
              ))}
            </List>
          </Card>
        </section>
      )}
      <Payments contactId={contact.id} />
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
  const archive = useArchiveContact();
  const restore = useRestoreContact();
  const [sheet, setSheet] = useState<"edit" | "archive" | null>(null);
  const row = contact.data;

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
      {contact.isPending ? (
        <div role="status" aria-busy="true" aria-label={t("common.loading")}>
          <Card className="flex flex-col items-center gap-3 py-6">
            <Skeleton className="size-16 rounded-full" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-9 w-40" />
          </Card>
        </div>
      ) : contact.isError || !row ? (
        <Empty
          tone="danger"
          icon={<User {...iconProps("lg")} />}
          title={t("states.error.title")}
          body={<LoadErrorBody error={contact.error} />}
          action={
            <Button
              onClick={() => {
                void contact.refetch();
              }}
            >
              {t("common.retry")}
            </Button>
          }
        />
      ) : (
        <>
          <PersonBody contact={row} />
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
          <ContactFormSheet
            open={sheet === "edit"}
            contact={row}
            onClose={() => {
              setSheet(null);
            }}
          />
          <Sheet
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
        </>
      )}
    </div>
  );
}
