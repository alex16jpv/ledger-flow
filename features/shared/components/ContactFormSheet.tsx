"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AtSign, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { Alert } from "@/components/ui/Alert";
import { Field, Input } from "@/components/ui/Field";
import { Sheet, SheetAction, SheetCancel, useUnsavedGuard } from "@/components/ui/Sheet";
import { SwatchGrid } from "@/components/ui/Swatch";
import { useToast } from "@/components/ui/Toast";
import { ApiError, fieldErrors, presentError } from "@/lib/api/errors";
import { changedOnly, nothingChanged } from "@/lib/form/changes";
import { validationMessage } from "@/lib/i18n/validation";
import { iconProps } from "@/lib/icons/sizes";
import { randomColorToken } from "@/lib/theme/feature-color";
import type { Contact } from "@/types/api";

import { useCreateContact, useUpdateContact } from "../hooks";
import { MAX_CONTACTS } from "../limits";
import { contactFormSchema, type ContactFormValues } from "../schemas";

export interface ContactFormSheetProps {
  open: boolean;
  onClose: () => void;
  contact?: Contact;
  onSaved?: (contact: Contact) => void;
}

export function ContactFormSheet({ open, onClose, contact, onSaved }: ContactFormSheetProps) {
  const t = useTranslations();
  const toast = useToast();
  const create = useCreateContact();
  const update = useUpdateContact(contact?.id ?? "");
  const mutation = contact ? update : create;
  const [suggested] = useState(() => randomColorToken());
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: contact?.name ?? "",
      color: contact?.color ?? suggested,
      email: contact?.email ?? "",
    },
  });
  const { errors, dirtyFields, isDirty } = form.formState;
  useUnsavedGuard(isDirty);
  const serverFields = fieldErrors(mutation.error);
  const duplicate = mutation.error instanceof ApiError && mutation.error.code === "DUPLICATE";
  const failure =
    mutation.error && !duplicate && Object.keys(serverFields).length === 0
      ? presentError(mutation.error)
      : null;

  function done(saved: Contact) {
    form.reset({ name: saved.name, color: saved.color ?? suggested, email: saved.email ?? "" });
    onSaved?.(saved);
    onClose();
    toast.show({ message: t(contact ? "shared.form.saved" : "shared.form.created") });
  }

  const submit = form.handleSubmit(async (values) => {
    try {
      if (contact) {
        const changes = changedOnly(
          { name: values.name, color: values.color, email: values.email || null },
          dirtyFields,
        );
        done(nothingChanged(changes) ? contact : await update.mutateAsync(changes));
        return;
      }
      done(
        await create.mutateAsync({
          name: values.name,
          color: values.color,
          ...(values.email === "" ? {} : { email: values.email }),
        }),
      );
    } catch {
      return;
    }
  });

  return (
    <Sheet
      layout="full"
      open={open}
      onClose={onClose}
      unsaved={isDirty}
      title={t(contact ? "shared.form.editTitle" : "shared.form.title")}
      footer={
        <>
          <SheetAction
            block
            loading={mutation.isPending}
            onClick={() => {
              void submit();
            }}
          >
            {t(contact ? "common.saveChanges" : "shared.form.create")}
          </SheetAction>
          <SheetCancel />
        </>
      }
    >
      <form
        onSubmit={(event) => {
          void submit(event);
        }}
        noValidate
        className="flex flex-col gap-3"
      >
        <Field
          label={t("shared.form.name")}
          error={
            duplicate
              ? t("shared.form.duplicate", { name: form.getValues("name").trim() })
              : validationMessage(t, errors.name?.message ?? serverFields.name)
          }
        >
          <Input
            placeholder={t("shared.form.namePlaceholder")}
            autoComplete="off"
            leading={<User {...iconProps("sm")} />}
            {...form.register("name")}
          />
        </Field>
        <Controller
          control={form.control}
          name="color"
          render={({ field }) => (
            <Field
              label={t("shared.form.color")}
              error={validationMessage(t, errors.color?.message)}
            >
              <SwatchGrid
                value={field.value}
                onChange={field.onChange}
                label={t("shared.form.color")}
              />
            </Field>
          )}
        />
        <Field
          label={t("shared.form.email")}
          optional
          help={t("shared.form.emailHelp")}
          error={validationMessage(t, errors.email?.message ?? serverFields.email)}
        >
          <Input
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder={t("shared.form.emailPlaceholder")}
            leading={<AtSign {...iconProps("sm")} />}
            {...form.register("email")}
          />
        </Field>
        {/* The limit is said here, never discovered by a save that fails. */}
        {!contact && (
          <Alert tone="neutral">{t("shared.form.limit", { contacts: MAX_CONTACTS })}</Alert>
        )}
        {failure && <p className="text-sm text-danger">{t(failure.messageKey)}</p>}
      </form>
    </Sheet>
  );
}
