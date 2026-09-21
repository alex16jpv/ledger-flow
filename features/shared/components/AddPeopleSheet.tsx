"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { Avatar } from "@/components/shell/Avatar";
import { Alert } from "@/components/ui/Alert";
import { Amount } from "@/components/ui/Amount";
import { Card } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Field";
import { List, Row, RowBody, RowMeta, RowRight, RowTitle } from "@/components/ui/Row";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { presentError } from "@/lib/api/errors";
import { useMoney } from "@/lib/i18n/useMoney";
import { fromCents, toCents } from "@/lib/local/derive/money";
import { useOffline } from "@/lib/network/useOffline";
import type { Contact, DefaultSplit } from "@/types/api";

import { useAddParticipants, usePreviewParticipants, useRemoveParticipant } from "../hooks";
import type { GroupView } from "../ledger";
import { USER_KEY } from "../split";
import { groupDefaultSplit } from "../write";
import { ContactPickerSheet } from "./ContactPickerSheet";
import { DefaultSplitFields, type DefaultSplitPerson, percentIsWhole } from "./DefaultSplitFields";
import { StateBadge } from "./parts";

export interface AddPeopleSheetProps {
  view: GroupView;
  open: boolean;
  onClose: () => void;
}

interface PreviewRow {
  key: string;
  name: string;
  color: DefaultSplitPerson["color"];
  shareAfter: number;
  note: string;
  state: "NOT_PAID" | "PARTIALLY_PAID" | "PAID" | "WRITTEN_OFF";
}

export function AddPeopleSheet({ view, open, onClose }: AddPeopleSheetProps) {
  const t = useTranslations("shared.addPeople");
  const root = useTranslations();
  const money = useMoney();
  const toast = useToast();
  const offline = useOffline();
  const add = useAddParticipants();
  const take = useRemoveParticipant();
  const preview = usePreviewParticipants();
  const [picked, setPicked] = useState<Contact[]>([]);
  const [apply, setApply] = useState(false);
  const [percent, setPercent] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      view.group.defaultSplit.shares.map((share) => [
        share.contactId ?? USER_KEY,
        String(share.percent),
      ]),
    ),
  );

  const already = view.group.participants.flatMap((one) => (one.contactId ? [one.contactId] : []));
  // Offered only while they have no share in any expense and nothing paid.
  const removable = already.filter((contactId) => {
    const person = view.people.find((one) => one.contactId === contactId);
    return person === undefined || (person.share === 0 && person.paid === 0);
  });
  const mode: DefaultSplit["mode"] = view.group.defaultSplit.mode;
  // A percentage group must send the new percentages: the old ones no longer cover everybody.
  const splitPeople: DefaultSplitPerson[] = [
    { contactId: null, name: t("you"), color: null },
    ...view.group.participants
      .flatMap((one) => (one.contactId ? [one.contactId] : []))
      .map((contactId) => {
        const person = view.people.find((one) => one.contactId === contactId);
        return { contactId, name: person?.name ?? "", color: person?.color ?? null };
      }),
    ...picked.map((one) => ({
      contactId: one.id,
      name: one.name,
      color: one.color ?? null,
    })),
  ];
  const needsPercent = mode === "PERCENT" && picked.length > 0;
  const percentReady = !needsPercent || percentIsWhole(mode, splitPeople, percent);

  const asked = apply && picked.length > 0 && percentReady;
  const groupId = view.group.id;
  const pickedIds = picked.map((one) => one.id).join(",");
  const percentTyped = JSON.stringify(percent);
  const splitIds = splitPeople.map((person) => person.contactId ?? USER_KEY).join(",");
  const askedSplit = useMemo(
    () =>
      groupDefaultSplit(
        mode,
        splitIds.split(",").map((key) => (key === USER_KEY ? null : key)),
        JSON.parse(percentTyped) as Record<string, string>,
      ),
    [mode, splitIds, percentTyped],
  );
  const { mutate: ask, reset: forget } = preview;
  // The question changes with who is picked and with the percentages they would take.
  useEffect(() => {
    if (!asked) {
      forget();
      return;
    }
    ask({
      id: groupId,
      body: {
        contactIds: pickedIds.split(","),
        applyToExistingExpenses: true,
        ...(needsPercent ? { defaultSplit: askedSplit } : {}),
      },
    });
  }, [asked, ask, forget, groupId, pickedIds, needsPercent, askedSplit]);

  function noteOf(contactId: string | null, shareAfter: number, paid: number): string {
    if (contactId === null) return t("yourShareOf", { amount: money.format(shareAfter) });
    const ceiling = ceilingOf(contactId);
    if (ceiling !== null) {
      return t("writtenOffBecomes", {
        before: money.format(ceiling),
        after: money.format(fromCents(Math.max(0, toCents(shareAfter) - toCents(paid)))),
      });
    }
    const ahead = toCents(paid) - toCents(shareAfter);
    if (ahead > 0) {
      return t("nowAhead", { paid: money.format(paid), ahead: money.format(fromCents(ahead)) });
    }
    if (paid > 0) {
      return t("paidAndOwes", { paid: money.format(paid), owed: money.format(fromCents(-ahead)) });
    }
    return t("nothingPaid");
  }

  function ceilingOf(contactId: string): number | null {
    const off = view.group.writeOffs.find(
      (one) => one.contactId === contactId && one.expenseId === null,
    );
    return off ? off.amount : null;
  }

  function stateOf(
    contactId: string | null,
    shareAfter: number,
    paid: number,
  ): PreviewRow["state"] {
    if (contactId !== null && ceilingOf(contactId) !== null) return "WRITTEN_OFF";
    if (toCents(paid) >= toCents(shareAfter)) return "PAID";
    return paid > 0 ? "PARTIALLY_PAID" : "NOT_PAID";
  }

  const rows: PreviewRow[] = (preview.data?.participants ?? []).map((one) => {
    const person = view.people.find((party) => party.contactId === one.contactId);
    const chosen = picked.find((party) => party.id === one.contactId);
    const paid = person?.paid ?? 0;
    return {
      key: one.contactId ?? USER_KEY,
      name: one.contactId === null ? t("you") : (person?.name ?? chosen?.name ?? ""),
      color: one.contactId === null ? null : (person?.color ?? chosen?.color ?? null),
      shareAfter: one.shareAfter,
      note: noteOf(one.contactId, one.shareAfter, paid),
      state: stateOf(one.contactId, one.shareAfter, paid),
    };
  });

  async function submit(contacts: Contact[]) {
    if (contacts.length === 0) return;
    try {
      await add.mutateAsync({
        id: view.group.id,
        contactIds: contacts.map((one) => one.id),
        applyToExistingExpenses: apply,
        ...(needsPercent ? { defaultSplit: askedSplit } : {}),
      });
      toast.show({ message: t("added", { count: contacts.length }) });
      onClose();
    } catch (error) {
      toast.show({ message: root(presentError(error).messageKey), tone: "danger" });
    }
  }

  async function remove(contact: Contact) {
    try {
      await take.mutateAsync({ id: view.group.id, contactId: contact.id });
      toast.show({ message: t("takenOut", { name: contact.name }) });
    } catch (error) {
      toast.show({ message: root(presentError(error).messageKey), tone: "danger" });
    }
  }

  return (
    <ContactPickerSheet
      open={open}
      onClose={onClose}
      selected={[]}
      inGroup={view.group.participants.length}
      title={t("title")}
      confirmLabel={t("add", { count: picked.length })}
      pending={add.isPending}
      disabled={!percentReady}
      alreadyIn={already}
      removable={removable}
      onRemove={(contact) => {
        void remove(contact);
      }}
      onDone={(contacts) => {
        void submit(contacts);
      }}
      onPicked={setPicked}
      extra={
        <div className="flex flex-col gap-3">
          {needsPercent && (
            <DefaultSplitFields
              mode={mode}
              onMode={() => undefined}
              people={splitPeople}
              percent={percent}
              onPercent={setPercent}
            />
          )}
          <div className="flex items-center gap-3">
            <Switch
              checked={apply}
              disabled={offline || picked.length === 0}
              label={t("applyToExisting", {
                count: view.expenses.length,
                name: picked[0]?.name ?? "",
              })}
              onCheckedChange={setApply}
            />
            <span className="text-sm">
              {t("applyToExisting", {
                count: view.expenses.length,
                name: picked[0]?.name ?? "",
              })}
            </span>
          </div>
          {offline && <p className="text-xs text-text-3">{t("applyNeedsNetwork")}</p>}
          {asked && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium tracking-caps text-text-3 uppercase">
                {t("howItWouldEndUp", { name: view.group.name })}
              </span>
              {preview.isPending && <Skeleton className="h-24 w-full" />}
              {preview.isError && <Alert tone="danger">{t("previewFailed")}</Alert>}
              {preview.data && (
                <>
                  <Card flush>
                    <List>
                      {rows.map((row) => (
                        <Row key={row.key}>
                          <Avatar name={row.name} color={row.color} />
                          <RowBody>
                            <RowTitle>
                              <span>{row.name}</span>
                              {row.key !== USER_KEY && <StateBadge state={row.state} />}
                            </RowTitle>
                            <RowMeta items={[row.note]} />
                          </RowBody>
                          <RowRight sub={t("shareSub")}>
                            <Amount value={row.shareAfter} signed={false} />
                          </RowRight>
                        </Row>
                      ))}
                    </List>
                  </Card>
                  <p className="text-sm text-text-3">
                    {t("nothingMoves", { amount: money.format(view.countsAsYours) })}
                  </p>
                  {preview.data.expenses.untouched > 0 && (
                    <p className="text-xs text-text-3">
                      {t("untouched", { count: preview.data.expenses.untouched })}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
          <p className="text-xs text-text-3">
            {t("wholeGroupOrNone", { count: view.expenses.length })}
          </p>
        </div>
      }
    />
  );
}
