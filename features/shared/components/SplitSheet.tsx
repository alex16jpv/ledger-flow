"use client";

import { Lock, Plus, Split, Undo2, Users, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Avatar } from "@/components/shell/Avatar";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Field, Input } from "@/components/ui/Field";
import { Segment } from "@/components/ui/Segment";
import { Sheet, SheetCancel } from "@/components/ui/Sheet";
import { Tile } from "@/components/ui/Tile";
import { useMoney } from "@/lib/i18n/useMoney";
import { iconProps } from "@/lib/icons/sizes";
import { SplitInvalidError } from "@/lib/local/derive";
import type { SharedShare, SharedSplit } from "@/types/api";

import { MAX_GUESTS } from "../limits";
import {
  GUESTS_KEY,
  leftToAssign,
  partiesOf,
  resolveDraft,
  SPLIT_MODES,
  type SplitDraft,
  splitInputOf,
  type SplitParty,
  splitProblem,
  USER_KEY,
} from "../split";
import { ContactPickerSheet } from "./ContactPickerSheet";

export interface SplitPerson {
  contactId: string | null;
  name: string;
  color: SplitParty["color"];
}

export interface SplitResult {
  split: SharedSplit;
  shares: SharedShare[];
  people: SplitPerson[];
}

export interface SplitSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  total: number;
  currency: string;
  people: SplitPerson[];
  // Who fronted the money: their row takes the odd minor unit, and it is never the block of guests.
  payerContactId: string | null;
  initial?: SplitDraft;
  choosePeople?: boolean;
  note?: string;
  saveLabel: string;
  pending?: boolean;
  onSave: (result: SplitResult) => void;
  onUseGroupSplit?: () => void;
}

const ROW_INPUT = "h-10 text-right tabular-nums";

const keyOfShare = (share: SharedShare): string =>
  share.party === "GUESTS" ? GUESTS_KEY : (share.contactId ?? USER_KEY);

export function SplitSheet({
  open,
  onClose,
  title,
  total,
  currency,
  people,
  payerContactId,
  initial,
  choosePeople = false,
  note,
  saveLabel,
  pending = false,
  onSave,
  onUseGroupSplit,
}: SplitSheetProps) {
  const t = useTranslations("shared.split");
  const money = useMoney();
  const [draft, setDraft] = useState<SplitDraft>(
    initial ?? { mode: "EQUAL", guests: null, inputs: {} },
  );
  const [chosen, setChosen] = useState<SplitPerson[]>(people);
  const [picking, setPicking] = useState(false);
  const [typed, setTyped] = useState<Record<string, string>>({});
  // Kept as typed so the field can be emptied to write another number, not only added to.
  const [guestText, setGuestText] = useState<string | null>(null);

  const parties = useMemo(() => partiesOf(chosen, draft.guests), [chosen, draft.guests]);
  const payerKey = payerContactId ?? USER_KEY;
  const left = leftToAssign(draft, parties, total, currency);
  const resolved = useMemo(() => {
    try {
      return { shares: resolveDraft(draft, parties, total, currency, payerKey), error: null };
    } catch (error) {
      if (error instanceof SplitInvalidError) return { shares: null, error };
      throw error;
    }
  }, [draft, parties, total, currency, payerKey]);

  const setInput = (key: string, raw: string) => {
    setTyped((was) => ({ ...was, [key]: raw }));
    const value = raw.trim() === "" ? null : money.parse(raw);
    setDraft((was) => ({
      ...was,
      inputs: { ...was.inputs, [key]: value === null || Number.isNaN(value) ? null : value },
    }));
  };

  const shown = (party: SplitParty): string => {
    const raw = typed[party.key];
    if (raw !== undefined) return raw;
    if (draft.mode === "EQUAL") {
      const share = resolved.shares?.find((one) => keyOfShare(one) === party.key);
      return share ? money.format(share.amount) : "";
    }
    const value = draft.inputs[party.key];
    return value === null || value === undefined ? "" : String(value);
  };

  const canSave = resolved.shares !== null && left === 0;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button
            size="lg"
            block
            loading={pending}
            disabled={!canSave}
            onClick={() => {
              if (!resolved.shares) return;
              onSave({
                split: { ...splitInputOf(draft, parties), shares: resolved.shares },
                shares: resolved.shares,
                people: chosen,
              });
            }}
          >
            {saveLabel}
          </Button>
          <SheetCancel />
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {choosePeople && (
          <Field label={t("whoWasIn")}>
            <div className="flex flex-wrap gap-2">
              {chosen.map((person) => (
                <Chip
                  key={person.contactId ?? USER_KEY}
                  selected
                  disabled={person.contactId === null}
                  onClick={() => {
                    setChosen((was) => was.filter((one) => one.contactId !== person.contactId));
                  }}
                >
                  <Avatar name={person.name} color={person.color} size="sm" />
                  {person.name}
                  {person.contactId !== null && <X {...iconProps("sm")} />}
                </Chip>
              ))}
              <Chip
                onClick={() => {
                  setPicking(true);
                }}
              >
                <Plus {...iconProps("sm")} />
                {t("addPerson")}
              </Chip>
            </div>
          </Field>
        )}
        <Segment
          label={t("mode")}
          value={draft.mode}
          onChange={(mode) => {
            setTyped({});
            setDraft((was) => ({ ...was, mode, inputs: {} }));
          }}
          options={SPLIT_MODES.map((mode) => ({ value: mode, label: t(`modes.${mode}`) }))}
        />
        {draft.guests === null ? (
          <Button
            variant="ghost"
            size="sm"
            className="self-start pl-0"
            onClick={() => {
              setGuestText(null);
              setDraft((was) => ({ ...was, guests: { count: 1, name: null } }));
            }}
          >
            <Plus {...iconProps("sm")} />
            {t("addGuests")}
          </Button>
        ) : (
          // The count sits above the rows because it governs every one of them.
          <Field label={t("guests.label")} help={t("guests.help")}>
            <div className="flex items-center gap-3">
              <span className="w-[84px] shrink-0">
                <Input
                  inputMode="numeric"
                  className="h-11 text-center tabular-nums"
                  value={guestText ?? String(draft.guests.count)}
                  aria-label={t("guests.count")}
                  onChange={(event) => {
                    const raw = event.target.value;
                    setGuestText(raw);
                    const parsed = Number.parseInt(raw, 10);
                    const count = Number.isNaN(parsed)
                      ? 1
                      : Math.min(MAX_GUESTS, Math.max(1, parsed));
                    setDraft((was) => ({ ...was, guests: { count, name: null } }));
                  }}
                />
              </span>
              <span className="flex-1 text-sm text-text-3">
                {t("guests.shares", {
                  people: chosen.length,
                  guests: draft.guests.count,
                  shares: chosen.length + draft.guests.count,
                })}
              </span>
              <Button
                variant="ghost"
                iconOnly
                round
                aria-label={t("guests.remove")}
                onClick={() => {
                  setGuestText(null);
                  setDraft((was) => ({ ...was, guests: null }));
                }}
              >
                <X {...iconProps("sm")} />
              </Button>
            </div>
          </Field>
        )}
        <div className="flex flex-col gap-2.5">
          {parties.map((party) => (
            <div key={party.key} className="flex items-center gap-3">
              {party.party === "GUESTS" ? (
                <Tile size="sm" color="GRAY">
                  <Users {...iconProps("sm")} />
                </Tile>
              ) : (
                <Avatar name={party.name} color={party.color} />
              )}
              <span className="min-w-0 flex-1 truncate font-medium">
                {party.party === "GUESTS" ? t("guests.row", { count: party.units }) : party.name}
              </span>
              {draft.mode === "FIXED_REST" && (
                <Button
                  variant="ghost"
                  iconOnly
                  round
                  size="sm"
                  aria-pressed={
                    draft.inputs[party.key] !== null && draft.inputs[party.key] !== undefined
                  }
                  aria-label={t(
                    draft.inputs[party.key] === null || draft.inputs[party.key] === undefined
                      ? "takesTheRest"
                      : "fixedFor",
                    { name: party.name },
                  )}
                  onClick={() => {
                    const pinned =
                      draft.inputs[party.key] === null || draft.inputs[party.key] === undefined;
                    setTyped((was) => ({ ...was, [party.key]: "" }));
                    setDraft((was) => ({
                      ...was,
                      inputs: { ...was.inputs, [party.key]: pinned ? 0 : null },
                    }));
                  }}
                >
                  {draft.inputs[party.key] === null || draft.inputs[party.key] === undefined ? (
                    <Split {...iconProps("sm")} />
                  ) : (
                    <Lock {...iconProps("sm")} />
                  )}
                </Button>
              )}
              {draft.mode === "PERCENT" && (
                <span className="text-sm text-text-3 tabular-nums">
                  {money.format(
                    resolved.shares?.find((one) => keyOfShare(one) === party.key)?.amount ?? 0,
                  )}
                </span>
              )}
              <span className="w-[132px] shrink-0">
                <Input
                  inputMode="decimal"
                  className={ROW_INPUT}
                  disabled={draft.mode === "EQUAL"}
                  aria-label={t("shareOf", { name: party.name })}
                  value={shown(party)}
                  onChange={(event) => {
                    setInput(party.key, event.target.value);
                  }}
                />
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="text-sm text-text-3">{t("leftToAssign")}</span>
          <span className="font-semibold tabular-nums">{money.format(left)}</span>
        </div>
        {/* The odd minor unit goes to whoever paid, and the sheet says so in words. */}
        {draft.mode === "EQUAL" && <Alert tone="neutral">{t("oddUnit")}</Alert>}
        {resolved.error !== null && (
          <Alert tone="warning">{t(`invalid.${splitProblem(draft, parties, left)}`)}</Alert>
        )}
        {note && <Alert tone="neutral">{note}</Alert>}
        {onUseGroupSplit && (
          <Button variant="ghost" size="sm" className="self-start pl-0" onClick={onUseGroupSplit}>
            <Undo2 {...iconProps("sm")} />
            {t("useGroupSplit")}
          </Button>
        )}
      </div>
      {picking && (
        <ContactPickerSheet
          open
          onClose={() => {
            setPicking(false);
          }}
          selected={chosen.flatMap((one) => (one.contactId === null ? [] : [one.contactId]))}
          onDone={(added) => {
            setChosen((was) => [
              ...was.filter((one) => one.contactId === null),
              ...added.map((one) => ({
                contactId: one.id,
                name: one.name,
                color: one.color ?? null,
              })),
            ]);
            setPicking(false);
          }}
        />
      )}
    </Sheet>
  );
}
