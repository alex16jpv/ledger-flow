"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { Avatar } from "@/components/shell/Avatar";
import { Alert } from "@/components/ui/Alert";
import { Amount } from "@/components/ui/Amount";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Field";
import { LoadErrorBody } from "@/components/ui/LoadErrorBody";
import { List, Row, RowBody, RowMeta, RowRight, RowTitle } from "@/components/ui/Row";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { presentError } from "@/lib/api/errors";
import { useMoney } from "@/lib/i18n/useMoney";
import { useOffline } from "@/lib/network/useOffline";
import type { Contact, DefaultSplit } from "@/types/api";

import {
  useAddParticipants,
  useContactsQuery,
  usePreviewParticipants,
  useRemoveParticipant,
} from "../hooks";
import type { GroupView } from "../ledger";
import { type PreviewRow, previewRows } from "../participants";
import { USER_KEY } from "../split";
import { groupDefaultSplit } from "../write";
import { ContactPickerSheet } from "./ContactPickerSheet";
import { DefaultSplitFields, type DefaultSplitPerson, percentIsWhole } from "./DefaultSplitFields";
import { StateBadge } from "./parts";

const PREVIEW_DEBOUNCE_MS = 300;

export interface AddPeopleSheetProps {
  view: GroupView;
  open: boolean;
  onClose: () => void;
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

  // Somebody added and not yet in an expense holds no share, so their name comes from the contact.
  const contacts = useContactsQuery(true);
  const byId = new Map((contacts.data ?? []).map((row) => [row.id, row]));
  const already = view.group.participants.flatMap((one) => (one.contactId ? [one.contactId] : []));
  // Offered only while they have no share in any expense and nothing paid.
  const removable = already.filter((contactId) => {
    const person = view.people.find((one) => one.contactId === contactId);
    return person === undefined || (person.share === 0 && person.paid === 0);
  });
  const mode: DefaultSplit["mode"] = view.group.defaultSplit.mode;
  // A percentage group must send the new percentages: the old ones no longer cover everybody.
  const splitPeople: DefaultSplitPerson[] = [
    { contactId: null, name: root("shared.group.you"), color: null },
    ...view.group.participants
      .flatMap((one) => (one.contactId ? [one.contactId] : []))
      .map((contactId) => {
        const contact = byId.get(contactId);
        return { contactId, name: contact?.name ?? "", color: contact?.color ?? null };
      }),
    ...picked.map((one) => ({
      contactId: one.id,
      name: one.name,
      color: one.color ?? null,
    })),
  ];
  const needsPercent = mode === "PERCENT" && picked.length > 0;
  const percentReady = !needsPercent || percentIsWhole(mode, splitPeople, percent);

  const applyLabel =
    picked.length === 1
      ? t("applyToExistingOne", { count: view.expenses.length, name: picked[0]?.name ?? "" })
      : t("applyToExisting", { count: view.expenses.length });
  const cannotApply = offline || picked.length === 0;
  // A switch that cannot apply must not carry a yes into the write with no preview behind it.
  const asked = apply && !cannotApply && percentReady;
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
  // A percentage is typed digit by digit: one request when the typing settles, not one each.
  useEffect(() => {
    if (!asked) {
      forget();
      return;
    }
    const timer = setTimeout(() => {
      ask({
        id: groupId,
        body: {
          contactIds: pickedIds.split(","),
          applyToExistingExpenses: true,
          ...(needsPercent ? { defaultSplit: askedSplit } : {}),
        },
      });
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [asked, ask, forget, groupId, pickedIds, needsPercent, askedSplit]);

  function noteOf(row: PreviewRow): string {
    if (row.contactId === null) return t("yourShareOf", { amount: money.format(row.shareAfter) });
    if (row.writtenOffBefore !== null) {
      return t("writtenOffBecomes", {
        before: money.format(row.writtenOffBefore),
        after: money.format(row.writtenOffAfter),
      });
    }
    if (row.ahead > 0) {
      return t("nowAhead", { paid: money.format(row.paid), ahead: money.format(row.ahead) });
    }
    if (row.paid > 0) {
      return t("paidAndOwes", {
        paid: money.format(row.paid),
        owed: money.format(row.writtenOffAfter),
      });
    }
    return t("nothingPaid");
  }

  const rows = preview.data ? previewRows(view, preview.data, picked) : [];

  async function submit(contacts: Contact[]) {
    if (contacts.length === 0) return;
    try {
      await add.mutateAsync({
        id: view.group.id,
        contactIds: contacts.map((one) => one.id),
        applyToExistingExpenses: asked,
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
      confirmLabel={
        picked.length === 1
          ? t("addOne", { name: picked[0]?.name ?? "" })
          : t("add", { count: picked.length })
      }
      pending={add.isPending}
      disabled={!percentReady || picked.length === 0}
      readOnlyRow={(one) => {
        if (!already.includes(one.id)) return null;
        if (!removable.includes(one.id)) return <Badge>{t("alreadyIn")}</Badge>;
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void remove(one);
            }}
          >
            {t("takeOut", { name: one.name })}
          </Button>
        );
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
          <label className="flex items-center gap-3 text-sm text-text-2">
            <Switch
              checked={apply}
              disabled={cannotApply}
              label={applyLabel}
              onCheckedChange={setApply}
            />
            <span aria-hidden="true">{applyLabel}</span>
          </label>
          {offline && <p className="text-xs text-text-3">{t("applyNeedsNetwork")}</p>}
          {asked && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium tracking-caps text-text-3 uppercase">
                {t("howItWouldEndUp", { name: view.group.name })}
              </span>
              {preview.isPending && <Skeleton className="h-24 w-full" />}
              {preview.isError && (
                <Alert tone="danger" title={t("previewFailed")}>
                  <LoadErrorBody error={preview.error} />
                </Alert>
              )}
              {preview.data && (
                <>
                  <Card flush>
                    <List>
                      {rows.map((row) => (
                        <Row key={row.key}>
                          <Avatar
                            name={row.contactId === null ? root("shared.group.you") : row.name}
                            color={row.color}
                          />
                          <RowBody>
                            <RowTitle>
                              <span>
                                {row.contactId === null ? root("shared.group.you") : row.name}
                              </span>
                              {row.contactId !== null && <StateBadge state={row.state} />}
                            </RowTitle>
                            <RowMeta items={[noteOf(row)]} />
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
