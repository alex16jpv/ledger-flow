"use client";

import { type SubmitEvent, useState } from "react";

import { Alert } from "./Alert";
import { Button } from "./Button";
import { Field, Input } from "./Field";
import { Sheet, SheetCancel } from "./Sheet";

export interface RenameRestoreSheetProps {
  open: boolean;
  title: string;
  body: string;
  nameLabel: string;
  confirmLabel: (name: string) => string;
  currentName: string;
  maxLength: number;
  pending: boolean;
  error?: string;
  onConfirm: (name: string) => void;
  onClose: () => void;
}

// Restoring into a taken name: the API renames in the same write, so the sheet only asks for the new name.
export function RenameRestoreSheet({
  open,
  title,
  body,
  nameLabel,
  confirmLabel,
  currentName,
  maxLength,
  pending,
  error,
  onConfirm,
  onClose,
}: RenameRestoreSheetProps) {
  const [name, setName] = useState(currentName);
  const trimmed = name.trim();
  const unchanged = trimmed.toLocaleLowerCase() === currentName.trim().toLocaleLowerCase();
  const formId = "rename-restore";

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (trimmed && !unchanged) onConfirm(trimmed);
  }

  return (
    <Sheet
      layout="dialog"
      open={open}
      onClose={onClose}
      unsaved={!unchanged}
      title={title}
      footer={
        <>
          <Button
            type="submit"
            form={formId}
            size="lg"
            block
            disabled={!trimmed || unchanged}
            loading={pending}
          >
            {confirmLabel(trimmed)}
          </Button>
          <SheetCancel />
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Alert tone="danger">{body}</Alert>
        <Field label={nameLabel} error={error}>
          <Input
            value={name}
            maxLength={maxLength}
            autoComplete="off"
            autoFocus
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
        </Field>
      </form>
    </Sheet>
  );
}
