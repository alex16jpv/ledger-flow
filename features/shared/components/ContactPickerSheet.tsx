"use client";

import { Plus, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useMemo, useState } from "react";

import { Avatar } from "@/components/shell/Avatar";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Field";
import { List, Row, RowBody, rowClasses, RowMeta, RowTitle } from "@/components/ui/Row";
import { Sheet, SheetCancel } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { iconProps } from "@/lib/icons/sizes";
import type { Contact } from "@/types/api";

import { useContactsPage } from "../hooks";
import { MAX_CONTACTS, MAX_PARTICIPANTS } from "../limits";
import { ContactFormSheet } from "./ContactFormSheet";

export interface ContactPickerSheetProps {
  open: boolean;
  onClose: () => void;
  selected: string[];
  onDone: (contacts: Contact[]) => void;
  // How many are already in the group, you included, so the limit can be said before a save fails.
  inGroup?: number;
  title?: string;
  confirmLabel?: string;
  pending?: boolean;
  disabled?: boolean;
  // A contact this caller cannot pick: what it returns is drawn on the right of a row that reads.
  readOnlyRow?: (contact: Contact) => ReactNode | null;
  // What the sheet asks after the list: the question that comes with adding people.
  extra?: ReactNode;
  onPicked?: (contacts: Contact[]) => void;
}

const matches = (contact: Contact, needle: string): boolean =>
  needle === "" ||
  contact.name.toLowerCase().includes(needle) ||
  (contact.email ?? "").toLowerCase().includes(needle);

export function ContactPickerSheet({
  open,
  onClose,
  selected,
  onDone,
  inGroup = 1,
  title,
  confirmLabel,
  pending = false,
  disabled = false,
  readOnlyRow,
  extra,
  onPicked,
}: ContactPickerSheetProps) {
  const t = useTranslations("shared.picker");
  const loading = useTranslations("common")("loading");
  const page = useContactsPage(open);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string[]>(selected);
  const [made, setMade] = useState<Contact[]>([]);
  const [creating, setCreating] = useState(false);

  const rows = useMemo(
    () => page.contacts.filter((one) => matches(one, search.trim().toLowerCase())),
    [page.contacts, search],
  );
  // Somebody added from here is chosen before the list has refetched; they must not be dropped.
  const known = [
    ...page.contacts,
    ...made.filter((one) => !page.contacts.some((row) => row.id === one.id)),
  ];
  const chosen = picked.flatMap((id) => {
    const contact = known.find((one) => one.id === id);
    return contact ? [contact] : [];
  });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title ?? t("title")}
      footer={
        <>
          <Button
            size="lg"
            block
            loading={pending}
            disabled={disabled}
            onClick={() => {
              onDone(chosen);
            }}
          >
            {confirmLabel ?? t("add", { count: picked.length })}
          </Button>
          <SheetCancel />
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Input
          type="search"
          leading={<Search {...iconProps("sm")} />}
          placeholder={t("search")}
          value={search}
          aria-label={t("search")}
          onChange={(event) => {
            setSearch(event.target.value);
          }}
        />
        <div className="-mx-4 max-h-[300px] overflow-auto">
          {page.isPending && (
            <div
              className="flex flex-col gap-3 px-4 py-3"
              role="status"
              aria-busy="true"
              aria-label={loading}
            >
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          )}
          <List>
            {rows.map((contact) => {
              const on = picked.includes(contact.id);
              const reads = readOnlyRow?.(contact);
              if (reads) {
                return (
                  <Row key={contact.id}>
                    <Avatar name={contact.name} color={contact.color} />
                    <RowBody>
                      <RowTitle>
                        <span>{contact.name}</span>
                      </RowTitle>
                      {contact.email && <RowMeta items={[contact.email]} />}
                    </RowBody>
                    {reads}
                  </Row>
                );
              }
              return (
                <Checkbox
                  key={contact.id}
                  checked={on}
                  className={rowClasses({ interactive: true })}
                  onChange={() => {
                    const next = on
                      ? picked.filter((id) => id !== contact.id)
                      : [...picked, contact.id];
                    setPicked(next);
                    onPicked?.(
                      next.flatMap((id) => {
                        const row = known.find((one) => one.id === id);
                        return row ? [row] : [];
                      }),
                    );
                  }}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={contact.name} color={contact.color} />
                    <RowBody>
                      <RowTitle>
                        <span>{contact.name}</span>
                      </RowTitle>
                      {contact.email && <RowMeta items={[contact.email]} />}
                    </RowBody>
                  </span>
                </Checkbox>
              );
            })}
          </List>
        </div>
        {page.isError && <p className="px-1 text-sm text-danger">{t("failed")}</p>}
        {!page.isPending && !page.isError && rows.length === 0 && (
          <p className="px-1 text-sm text-text-3">{t("none")}</p>
        )}
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-text-3">
            {t("showing", { shown: rows.length, total: page.total })}
          </span>
          <div className="flex items-center gap-1">
            {page.hasMore && (
              <Button
                variant="ghost"
                size="sm"
                loading={page.isFetchingNextPage}
                onClick={page.fetchNextPage}
              >
                {t("loadMore")}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCreating(true);
              }}
            >
              <Plus {...iconProps("sm")} />
              {t("newPerson")}
            </Button>
          </div>
        </div>
        {/* The two limits are said here, never discovered by a save that fails. */}
        <Alert tone="neutral">
          {t("limits", {
            people: MAX_PARTICIPANTS,
            contacts: MAX_CONTACTS,
            inGroup: inGroup + picked.filter((id) => !selected.includes(id)).length,
          })}
        </Alert>
        {extra}
      </div>
      {creating && (
        <ContactFormSheet
          open
          onClose={() => {
            setCreating(false);
          }}
          onSaved={(contact) => {
            setMade((was) => [...was, contact]);
            setPicked((was) => [...was, contact.id]);
            onPicked?.([...chosen, contact]);
          }}
        />
      )}
    </Sheet>
  );
}
