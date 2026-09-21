"use client";

import { ChevronDown, CircleCheck, Plus, User, Users, WifiOff } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";

import { Avatar } from "@/components/shell/Avatar";
import { PageHeader } from "@/components/shell/PageHeader";
import { Amount } from "@/components/ui/Amount";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";
import { Empty } from "@/components/ui/Empty";
import { LoadErrorBody } from "@/components/ui/LoadErrorBody";
import { List, RowBody, rowClasses, RowMeta, RowRight, RowTitle } from "@/components/ui/Row";
import { Segment } from "@/components/ui/Segment";
import { Skeleton } from "@/components/ui/Skeleton";
import { NetworkError } from "@/lib/api/errors";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { useMoney } from "@/lib/i18n/useMoney";
import { iconProps } from "@/lib/icons/sizes";

import { useSharedSection } from "../hooks";
import type { GroupView, PersonView } from "../ledger";
import { ContactFormSheet } from "./ContactFormSheet";
import { GroupRowLink } from "./GroupRowLink";
import { TwoFigures } from "./parts";

type Face = "people" | "groups";

const FACES: readonly Face[] = ["people", "groups"];

const NEW_HREF = "/shared/new";

const parseFace = (value: string | null): Face =>
  (FACES as readonly string[]).includes(value ?? "") ? (value as Face) : "people";

function PersonRowLink({ person }: { person: PersonView }) {
  const t = useTranslations("shared.people");
  return (
    <Link href={`/shared/people/${person.contactId}`} className={rowClasses({ interactive: true })}>
      <Avatar name={person.name} color={person.color} />
      <RowBody>
        <RowTitle>
          <span>{person.name}</span>
        </RowTitle>
        <RowMeta items={person.groups.map((group) => group.name)} />
      </RowBody>
      {/* Colour is data, so the direction is a word: a debt is neither income nor spending. */}
      <RowRight sub={person.net >= 0 ? t("owesYouWord") : t("youOweWord")}>
        <Amount value={Math.abs(person.net)} signed={false} />
      </RowRight>
    </Link>
  );
}

function Fold({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <section className="flex flex-col gap-3">
      <Card flush>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => {
            setOpen((was) => !was);
          }}
          className="flex min-h-14 w-full items-center gap-3 px-4 text-left font-medium hover:bg-surface-2"
        >
          <CircleCheck {...iconProps("md")} className="text-text-3" />
          <span className="flex-1">{label}</span>
          <Badge>{count}</Badge>
          <ChevronDown
            {...iconProps("md")}
            className={cn(
              "text-text-3 transition-transform duration-(--dur-1) ease-(--ease)",
              open && "rotate-180",
            )}
          />
        </button>
      </Card>
      <div id={id} hidden={!open}>
        {children}
      </div>
    </section>
  );
}

export function SharedView() {
  const t = useTranslations();
  const money = useMoney();
  const router = useRouter();
  const params = useSearchParams();
  const face = parseFace(params.get("face"));
  const { section, isPending, isError, error, refetch } = useSharedSection();
  // Offline with nothing on the device: there is no failure to report, only no copy to read.
  const offline = error instanceof NetworkError && !error.timedOut && section === undefined;
  const [newPerson, setNewPerson] = useState(false);

  const people = useMemo(() => {
    const rows = section?.people ?? [];
    return {
      owesYou: rows.filter((person) => person.net > 0),
      youOwe: rows.filter((person) => person.net < 0),
      settled: rows.filter((person) => person.net === 0),
      all: rows,
    };
  }, [section]);
  const groups = useMemo(() => {
    const rows = section?.groups ?? [];
    // A group with no expenses is settled by arithmetic and new by intent: it does not fold away.
    const folded = (view: GroupView) =>
      view.group.archivedAt !== null ||
      (view.group.status === "SETTLED" && view.group.totals.expenseCount > 0);
    return { open: rows.filter((view) => !folded(view)), folded: rows.filter(folded) };
  }, [section]);

  const nothingAtAll = section?.groups.length === 0 && section.people.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("shared.title")}
        actions={
          <>
            <span className="md:hidden">
              <Link
                href={NEW_HREF}
                aria-label={t("shared.new")}
                className={buttonClasses({ variant: "secondary", iconOnly: true, round: true })}
              >
                <Plus {...iconProps("md")} />
              </Link>
            </span>
            <span className="hidden md:inline-flex">
              <Link href={NEW_HREF} className={buttonClasses({})}>
                <Plus {...iconProps("sm")} />
                {t("shared.new")}
              </Link>
            </span>
          </>
        }
      />
      {isPending ? (
        <div
          className="flex flex-col gap-4"
          role="status"
          aria-busy="true"
          aria-label={t("common.loading")}
        >
          <Skeleton className="h-10 w-full rounded-md" />
          <Card className="flex flex-col gap-3">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-3 w-40" />
          </Card>
          <Card flush className="flex flex-col">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="flex min-h-[60px] items-center gap-3 px-4 py-3">
                <Skeleton className="size-9 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3 w-2/5" />
                  <Skeleton className="h-2.5 w-3/5" />
                </div>
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </Card>
        </div>
      ) : offline ? (
        <Empty
          icon={<WifiOff {...iconProps("lg")} />}
          title={t("transactions.list.offline.title")}
          body={t("shared.offline")}
          action={
            <Button variant="secondary" onClick={refetch}>
              {t("common.retry")}
            </Button>
          }
        />
      ) : isError ? (
        <Empty
          tone="danger"
          icon={<Users {...iconProps("lg")} />}
          title={t("states.error.title")}
          body={<LoadErrorBody error={error} />}
          action={<Button onClick={refetch}>{t("common.retry")}</Button>}
        />
      ) : nothingAtAll ? (
        // With nothing at all the two faces are not drawn: there is nothing to switch between.
        <Empty
          icon={<Users {...iconProps("lg")} />}
          title={t("shared.empty.title")}
          body={t("shared.empty.body")}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link href={NEW_HREF} className={buttonClasses({})}>
                <Plus {...iconProps("sm")} />
                {t("shared.new")}
              </Link>
              <Button
                variant="secondary"
                onClick={() => {
                  setNewPerson(true);
                }}
              >
                {t("shared.people.add")}
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <Segment<Face>
            label={t("shared.faces.label")}
            value={face}
            onChange={(next) => {
              router.replace({ pathname: "/shared", query: { face: next } });
            }}
            options={[
              {
                value: "people",
                label: t("shared.faces.people"),
                icon: <User {...iconProps("sm")} />,
              },
              {
                value: "groups",
                label: t("shared.faces.groups"),
                icon: <Users {...iconProps("sm")} />,
              },
            ]}
          />
          <TwoFigures
            owedToYou={section?.owedToYou ?? 0}
            youOwe={section?.youOwe ?? 0}
            meta={t("shared.summary.counts", {
              open: people.owesYou.length + people.youOwe.length,
              contacts: section?.contacts ?? 0,
            })}
          />
          {face === "people" ? (
            <>
              {people.owesYou.length > 0 && (
                <section className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between px-1">
                    <h2 className="text-md font-semibold">{t("shared.people.owesYou")}</h2>
                    <span className="text-sm text-text-3 tabular-nums">
                      {money.format(section?.owedToYou ?? 0)}
                    </span>
                  </div>
                  <Card flush>
                    <List>
                      {people.owesYou.map((person) => (
                        <PersonRowLink key={person.contactId} person={person} />
                      ))}
                    </List>
                  </Card>
                </section>
              )}
              {people.youOwe.length > 0 && (
                <section className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between px-1">
                    <h2 className="text-md font-semibold">{t("shared.people.youOwe")}</h2>
                    <span className="text-sm text-text-3 tabular-nums">
                      {money.format(section?.youOwe ?? 0)}
                    </span>
                  </div>
                  <Card flush>
                    <List>
                      {people.youOwe.map((person) => (
                        <PersonRowLink key={person.contactId} person={person} />
                      ))}
                    </List>
                  </Card>
                </section>
              )}
              {/* A block of guests is not a person: one line closes the arithmetic instead. */}
              {section && section.guests.owed > 0 && (
                <p className="px-1 text-sm text-text-3">
                  {t("shared.people.guests", {
                    amount: money.format(section.guests.owed),
                    count: section.guests.groupCount,
                  })}
                </p>
              )}
              {people.settled.length > 0 && (
                <Fold label={t("shared.people.settled")} count={people.settled.length}>
                  <Card flush>
                    <List>
                      {people.settled.map((person) => (
                        <PersonRowLink key={person.contactId} person={person} />
                      ))}
                    </List>
                  </Card>
                </Fold>
              )}
              <div className="flex items-center justify-between gap-3 px-1">
                <span className="text-xs text-text-3">
                  {t("shared.people.showing", {
                    shown: people.owesYou.length + people.youOwe.length,
                    total: people.all.length,
                  })}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setNewPerson(true);
                  }}
                >
                  <Plus {...iconProps("sm")} />
                  {t("shared.people.add")}
                </Button>
              </div>
            </>
          ) : (
            <>
              {groups.open.length > 0 && (
                <Card flush>
                  <List>
                    {groups.open.map((view) => (
                      <GroupRowLink key={view.group.id} view={view} />
                    ))}
                  </List>
                </Card>
              )}
              {groups.folded.length > 0 && (
                <Fold label={t("shared.groups.settled")} count={groups.folded.length}>
                  <Card flush>
                    <List>
                      {groups.folded.map((view) => (
                        <GroupRowLink key={view.group.id} view={view} />
                      ))}
                    </List>
                  </Card>
                </Fold>
              )}
              {groups.open.length === 0 && groups.folded.length === 0 && (
                <Empty
                  icon={<Users {...iconProps("lg")} />}
                  title={t("shared.empty.title")}
                  body={t("shared.empty.body")}
                />
              )}
            </>
          )}
        </>
      )}
      {newPerson && (
        <ContactFormSheet
          open
          onClose={() => {
            setNewPerson(false);
          }}
        />
      )}
    </div>
  );
}
