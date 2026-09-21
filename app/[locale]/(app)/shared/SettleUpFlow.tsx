"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Avatar } from "@/components/shell/Avatar";
import { Amount } from "@/components/ui/Amount";
import { Card } from "@/components/ui/Card";
import { List, RowBody, RowButton, RowMeta, RowRight, RowTitle } from "@/components/ui/Row";
import { Sheet } from "@/components/ui/Sheet";
import type { GroupView, PartyView, SharedSection } from "@/features/shared/ledger";
import { settleParty } from "@/features/shared/settle";

import { SettleUpSheet } from "./SettleUpSheet";

export interface SettleUpFlowProps {
  section: SharedSection;
  view: GroupView;
  // Everybody this door can settle with: one goes straight to the sheet, several ask first.
  parties: PartyView[];
  open: boolean;
  onClose: () => void;
  onWriteOff?: (person: PartyView) => void;
}

export function SettleUpFlow({
  section,
  view,
  parties,
  open,
  onClose,
  onWriteOff,
}: SettleUpFlowProps) {
  const t = useTranslations("shared");
  const [chosen, setChosen] = useState<PartyView | null>(null);
  const only = parties.length === 1 ? parties[0] : null;
  const person = chosen ?? only;

  if (!open) return null;
  if (!person) {
    return (
      <Sheet open onClose={onClose} title={t("group.whoToSettle")}>
        <Card flush>
          <List>
            {parties.map((one) => (
              <RowButton
                key={one.key}
                onClick={() => {
                  setChosen(one);
                }}
              >
                <Avatar name={one.name} color={one.color} />
                <RowBody>
                  <RowTitle>
                    <span>{one.name}</span>
                  </RowTitle>
                  <RowMeta
                    items={[
                      t(one.owesYou >= one.youOwe ? "people.owesYouWord" : "people.youOweWord"),
                    ]}
                  />
                </RowBody>
                <RowRight>
                  <Amount value={Math.abs(one.owesYou - one.youOwe)} signed={false} />
                </RowRight>
              </RowButton>
            ))}
          </List>
        </Card>
      </Sheet>
    );
  }

  return (
    <SettleUpSheet
      key={person.key}
      open
      party={settleParty(section, view, person)}
      onClose={() => {
        setChosen(null);
        onClose();
      }}
      onWriteOff={
        onWriteOff && person.owesYou > 0
          ? () => {
              setChosen(null);
              onClose();
              onWriteOff(person);
            }
          : undefined
      }
    />
  );
}
